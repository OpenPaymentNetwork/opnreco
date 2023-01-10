
This is the source code for the OPN (Open Payment Network) Reconciliation tool.
Use the tool to reconcile your OPN activity with
bank accounts. The tool is especially intended for issuers.

Build the software by using Make:

    cd backend
    make dev

Create a local opnreco database:

    sudo -u postgres createdb -O ${USER} opnreco
    venv/bin/initialize_opnreco_db development.ini

Once the backend is built successfully, build the frontend:

    cd ../frontend
    npm i
    cd ..

To run in development mode, open two terminals. Run the backend in the
first terminal:

    cd backend
    venv/bin/pserve --reload development.ini

Run the frontend in a second terminal:

    cd frontend
    npm start
