
This is the source code for the OPN Reconciliation tool. Use the tool to
reconcile your OPN activity with your bank account. The tool is especially
intended for issuers.

Build the software using Buildout:

    cd backend
    pyvenv .
    bin/pip install -r requirements.txt
    bin/buildout
    cd ..

Once the backend is built successfully, build the frontend:

    cd frontend
    npm i
    cd ..

To run in development mode, open two terminals. The first terminal will run
the backend:

    cd backend
    bin/pserve --reload development.ini

The second terminal will run the frontend:

    cd frontend
    npm start
