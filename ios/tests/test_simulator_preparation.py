import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare_simulator', Path(__file__).resolve().parents[1] / 'scripts/prepare_simulator.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SimulatorSelectionTests(unittest.TestCase):
    def inventory(self):
        return {'runtimes': [{'identifier': 'com.apple.CoreSimulator.SimRuntime.iOS-26-0', 'version': '26.0', 'isAvailable': True},
                             {'identifier': 'com.apple.CoreSimulator.SimRuntime.iOS-26-5', 'version': '26.5', 'isAvailable': True}],
                'devicetypes': [{'name': 'iPhone SE (3rd generation)', 'identifier': 'compact'}, {'name': 'iPhone 17 Pro', 'identifier': 'regular'}]}
    def test_selects_newest_available_runtime_and_requested_size(self):
        runtime, device = module.select_device(self.inventory(), 'compact')
        self.assertEqual(runtime['version'], '26.5')
        self.assertEqual(device['identifier'], 'compact')
    def test_unavailable_runtime_never_becomes_provenance(self):
        inventory = self.inventory(); inventory['runtimes'][1]['isAvailable'] = False
        self.assertEqual(module.select_device(inventory, 'regular')[0]['version'], '26.0')
    def test_stale_prepared_device_requires_matching_live_booted_uuid(self):
        import sys
        scripts = str(Path(__file__).resolve().parents[1] / 'scripts')
        if scripts not in sys.path: sys.path.insert(0, scripts)
        from test_simulators import prepared_device_is_live
        inventory = self.inventory()
        runtime, device = module.select_device(inventory, 'compact')
        prepared = {'profile': 'compact', 'device': device['name'],
                    'runtimeIdentifier': runtime['identifier'], 'id': 'sim-1'}
        self.assertFalse(prepared_device_is_live(prepared, inventory, 'compact', runtime, device))
        live = {'udid': 'sim-1', 'state': 'Booted', 'deviceTypeIdentifier': 'compact', 'isAvailable': True}
        inventory['devices'] = {runtime['identifier']: [live]}
        self.assertTrue(prepared_device_is_live(prepared, inventory, 'compact', runtime, device))
        live['deviceTypeIdentifier'] = 'regular'
        self.assertFalse(prepared_device_is_live(prepared, inventory, 'compact', runtime, device))
        live['deviceTypeIdentifier'] = 'compact'
        live['isAvailable'] = False
        self.assertFalse(prepared_device_is_live(prepared, inventory, 'compact', runtime, device))
        live['isAvailable'] = True
        inventory['devices'][runtime['identifier']][0]['state'] = 'Shutdown'
        self.assertFalse(prepared_device_is_live(prepared, inventory, 'compact', runtime, device))
        inventory['devices'][runtime['identifier']][0]['state'] = 'Booted'
        self.assertFalse(prepared_device_is_live({**prepared, 'id': 'deleted-uuid'}, inventory, 'compact', runtime, device))
        self.assertFalse(prepared_device_is_live({**prepared, 'runtimeIdentifier': 'wrong'}, inventory, 'compact', runtime, device))
        self.assertFalse(prepared_device_is_live(None, inventory, 'compact', runtime, device))

    def test_warmup_terminate_timeout_still_allows_xctest(self):
        import subprocess
        import sys
        from unittest.mock import patch
        scripts = str(Path(__file__).resolve().parents[1] / 'scripts')
        if scripts not in sys.path: sys.path.insert(0, scripts)
        from test_simulators import stop_warmup_app
        command = ['xcrun', 'simctl', 'terminate', 'sim-1', 'io.github.seifonyx.lumen']
        with patch('test_simulators.subprocess.run', side_effect=subprocess.TimeoutExpired(command, 30)) as mock_run:
            stop_warmup_app('sim-1')
        mock_run.assert_called_once_with(command, check=False, timeout=30)
        # An actual failure of the simulator utility is not silently swallowed.
        with patch('test_simulators.subprocess.run', side_effect=OSError('simctl missing')):
            with self.assertRaises(OSError): stop_warmup_app('sim-1')

    def test_two_ui_shards_cover_all_xctest_methods_once_on_each_iphone(self):
        import re
        import sys
        scripts = str(Path(__file__).resolve().parents[1] / 'scripts')
        if scripts not in sys.path: sys.path.insert(0, scripts)
        from test_simulators import SHARDS
        ui = (Path(__file__).resolve().parents[1] / 'LumenUITests/LumenUITests.swift').read_text()
        actual = re.findall(r'    func (test\w+)\(', ui)
        assigned = [name for names in SHARDS.values() for name in names]
        self.assertEqual(len(SHARDS), 2)
        self.assertEqual(len(actual), 14)
        self.assertEqual(len(assigned), len(set(assigned)), 'a UI method cannot run twice')
        self.assertEqual(set(assigned), set(actual), 'every UI method must run on both device sizes')
        self.assertEqual({name: len(names) for name, names in SHARDS.items()},
                         {'sync': 6, 'features': 8})

    def test_hosted_simulator_reuse_never_touches_local_or_wrong_devices(self):
        import os
        from unittest.mock import patch
        inventory = self.inventory()
        runtime, device_type = module.select_device(inventory, 'regular')
        matches = [
            {'udid': 'shutdown', 'state': 'Shutdown', 'isAvailable': True,
             'deviceTypeIdentifier': device_type['identifier']},
            {'udid': 'booted', 'state': 'Booted', 'isAvailable': True,
             'deviceTypeIdentifier': device_type['identifier']},
            {'udid': 'unavailable', 'state': 'Booted', 'isAvailable': False,
             'deviceTypeIdentifier': device_type['identifier']},
        ]
        inventory['devices'] = {runtime['identifier']: matches}
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'}):
            self.assertEqual(module.existing_hosted_device(inventory, runtime, device_type)['udid'], 'booted')
            inventory['devices'][runtime['identifier']] = [matches[0]]
            self.assertEqual(module.existing_hosted_device(inventory, runtime, device_type)['udid'], 'shutdown')
            inventory['devices'][runtime['identifier']] = [matches[2]]
            self.assertIsNone(module.existing_hosted_device(inventory, runtime, device_type))
        with patch.dict(os.environ, {'GITHUB_ACTIONS': ''}):
            inventory['devices'][runtime['identifier']] = matches
            self.assertIsNone(module.existing_hosted_device(inventory, runtime, device_type))

    def test_missing_runtime_or_profile_fails_instead_of_testing_another_device(self):
        with self.assertRaises(ValueError): module.select_device(self.inventory(), 'other')
        inventory = self.inventory(); inventory['runtimes'] = []
        with self.assertRaises(ValueError): module.select_device(inventory, 'compact')
