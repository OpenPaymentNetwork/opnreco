
This is the source code for the OPN Reconciliation tool. OPN is the Open
Payment Network. Use the tool to reconcile your OPN activity with your
bank account. The tool is especially intended for issuers.

Build the software using Buildout:

    cd backend
    python3 -m venv .
    bin/pip install -r requirements.txt
    bin/buildout -c buildout-dev.cfg
    cd ..

Once the backend is built successfully, build the frontend:

    cd frontend
    npm i
    cd ..

To run in development mode, open two terminals. Run the backend in the
first terminal:

    cd backend
    bin/pserve --reload development.ini

Run the frontend in a second terminal:

    cd frontend
    npm start
