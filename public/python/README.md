# Pinned Excel support for browser Python

Pure Python wheels downloaded from PyPI, verified against PyPI SHA-256 metadata.
Their licenses are included inside each wheel. Keep filenames/version pins in
src/lib/runner.ts aligned with these files.

- openpyxl 3.1.5 (MIT): 5282c12b107bffeef825f4617dc029afaf41d0ea60823bbb665ef3079dc79de2
- et-xmlfile 2.0.0 (MIT): 7a91720bc756843502c3b7504c77b8fe44217c85c537d85037f0f536151b2caa
- xlrd 2.0.1 (BSD): 6a33ee89877bd9abc1158129f6e94be74e2679636b8a205b43b85206c3f0bbdd

Pyodide 0.26.4 supplies pandas and matplotlib. These wheels supply XLSX/XLSM/XLS
reading and XLSX export without installing from a mutable package index at runtime.
