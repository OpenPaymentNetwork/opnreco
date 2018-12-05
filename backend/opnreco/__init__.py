
import warnings

warnings.filterwarnings(
    'ignore',
    module='psycopg2',
    message="The psycopg2 wheel package will be renamed from release 2.8")
