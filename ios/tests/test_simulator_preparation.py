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
        inventory['devices'] = {runtime['identifier']: [{'udid': 'sim-1', 'state': 'Booted'}]}
        self.assertTrue(prepared_device_is_live(prepared, inventory, 'compact', runtime, device))
        inventory['devices'][runtime['identifier']][0]['state'] = 'Shutdown'
        self.assertFalse(prepared_device_is_live(prepared, inventory, 'compact', runtime, device))
        inventory['devices'][runtime['identifier']][0]['state'] = 'Booted'
        self.assertFalse(prepared_device_is_live({**prepared, 'id': 'deleted-uuid'}, inventory, 'compact', runtime, device))
        self.assertFalse(prepared_device_is_live({**prepared, 'runtimeIdentifier': 'wrong'}, inventory, 'compact', runtime, device))
        self.assertFalse(prepared_device_is_live(None, inventory, 'compact', runtime, device))

    def test_missing_runtime_or_profile_fails_instead_of_testing_another_device(self):
        with self.assertRaises(ValueError): module.select_device(self.inventory(), 'other')
        inventory = self.inventory(); inventory['runtimes'] = []
        with self.assertRaises(ValueError): module.select_device(inventory, 'compact')
