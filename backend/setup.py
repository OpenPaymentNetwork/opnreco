
from setuptools import setup, find_packages


requires = [
    'colander',
    'defusedxml',
    'psycopg2',
    'pyramid',
    'pyramid_retry',
    'pyramid_tm',
    'python-dateutil',
    'python-dotenv',
    'pytz',
    'requests',
    'SQLAlchemy',
    'transaction',
    'xlrd',
    'zope.sqlalchemy',
]

setup(
    name='opnreco',
    version='2.0.1',
    description='OPN Reconciliation Tool',
    classifiers=[
        "Programming Language :: Python",
        "Framework :: Pyramid",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: Internet :: WWW/HTTP :: WSGI :: Application",
    ],
    author='',
    author_email='',
    url='',
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    test_suite='opnreco',
    install_requires=requires,
    extras_require={
        'test': ['responses'],
    },
    entry_points="""\
    [paste.app_factory]
    main = opnreco.main:main
    [console_scripts]
    initialize_opnreco_db = opnreco.scripts.initializedb:main
    """,
)
