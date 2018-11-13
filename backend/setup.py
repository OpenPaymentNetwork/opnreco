
from setuptools import setup, find_packages


requires = [
    'colander',
    'dateutil',
    'psycopg2',
    'python-dotenv',
    'pyramid',
    'pyramid_retry',
    'pyramid_tm',
    'requests',
    'SQLAlchemy',
    'transaction',
    'zope.sqlalchemy',
]

setup(
    name='opnreport',
    version='0.0',
    description='opnreport',
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
    test_suite='opnreport',
    install_requires=requires,
    extras_require={
        'test': ['responses'],
    },
    entry_points="""\
    [paste.app_factory]
    main = opnreport.main:main
    [console_scripts]
    initialize_opnreport_db = opnreport.scripts.initializedb:main
    """,
)
