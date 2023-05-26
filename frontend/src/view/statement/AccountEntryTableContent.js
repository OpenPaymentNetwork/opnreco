
import { refetchAll } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { injectIntl } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import AccountEntryDeleteDialog from './AccountEntryDeleteDialog';
import Add from '@material-ui/icons/Add';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Fab from '@material-ui/core/Fab';
import FormGroup from '@material-ui/core/FormGroup';
import PropTypes from 'prop-types';
import React from 'react';
import RecoCheckBox from '../report/RecoCheckBox';


const styles = theme => ({
  numCell: {
    textAlign: 'right',
    padding: '8px',
    border: '1px solid #bbb',
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.9rem',
    lineHeight: '16px',
    cursor: 'text',
  },
  textCell: {
    textAlign: 'left',
    padding: '8px',
    border: '1px solid #bbb',
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.9rem',
    lineHeight: '16px',
    cursor: 'text',
  },
  checkboxCell: {
    textAlign: 'center',
    padding: '0',
    border: '1px solid #bbb',
  },
  columnHeadCell: {
    fontWeight: 'normal',
    textAlign: 'left',
    padding: '8px',
    border: '1px solid #bbb',
  },
  saveCell: {
    padding: '8px',
    border: '1px solid #bbb',
  },
  addCell: {
    padding: '16px',
    border: '1px solid #bbb',
    textAlign: 'right',
  },
  button: {
    marginRight: '16px',
  },
  textCellEditing: {
    textAlign: 'left',
    padding: '0',
    border: '1px solid #bbb',
  },
  numCellEditing: {
    textAlign: 'right',
    padding: '0',
    border: '1px solid #bbb',
  },
  textInputField: {
    border: 'none',
    color: '#000',
    padding: '8px',
    width: '100%',
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.9rem',
    lineHeight: '16px',
  },
  numInputField: {
    border: 'none',
    color: '#000',
    padding: '8px',
    width: '100%',
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.9rem',
    lineHeight: '16px',
  },
});


class AccountEntryTableContent extends React.Component {
  static propTypes = {
    archived: PropTypes.bool,
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
    period: PropTypes.object.isRequired,
    record: PropTypes.object.isRequired,
    recordURL: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      // editingEntries: {accountEntryId: {changed, saving, focus, ...fields}}
      editingEntries: {},
    };
  }

  getEntry(event, fromState) {
    let element = event.target;

    let entryId = null;
    while (element) {
      entryId = element.getAttribute('data-account-entry-id');
      if (entryId) {
        break;
      } else {
        element = element.parentElement;
      }
    }

    if (!entryId) {
      return null;
    }

    if (fromState) {
      return this.state.editingEntries[entryId];
    } else {
      for (const e of this.props.record.entries) {
        if (e.id === entryId) {
          return e;
        }
      }
      return null;
    }
  }

  getName(event) {
    let element = event.target;
    while (element) {
      const name = element.getAttribute('data-name');
      if (name) {
        return name;
      } else {
        element = element.parentElement;
      }
    }
    return null;
  }

  handleClickEntry = (event) => {
    const entry = this.getEntry(event);

    if (!entry || this.state.editingEntries[entry.id]) {
      return;
    }

    const dateOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    };

    const { intl } = this.props;

    this.setState({
      editingEntries: {
        ...this.state.editingEntries,
        [entry.id]: {
          id: entry.id,
          changed: false,
          saving: false,
          reco_id: entry.reco_id,
          focus: this.getName(event),
          entry_date: intl.formatDate(entry.entry_date, dateOptions),
          delta: entry.delta,
          sheet: entry.sheet || '',
          row: entry.row || '',
          description: entry.description || '',
        },
      },
    });
  };

  editEntry(entry, changes) {
    this.setState({
      editingEntries: {
        ...this.state.editingEntries,
        [entry.id]: {
          ...entry,
          ...changes,
        },
      },
    });
  }

  cancelEntry(entry) {
    this.setState({
      adding: false,
      editingEntries: {
        ...this.state.editingEntries,
        [entry.id]: undefined,
      },
    });
  }

  handleEdit = (event) => {
    const entry = this.getEntry(event, true);
    if (!entry) {
      return;
    }

    this.editEntry(entry, {
      changed: true,
      [event.target.name]: event.target.value,
    });
  };

  handleSave = (event) => {
    const entry = this.getEntry(event, true);
    if (!entry) {
      return;
    }

    const {
      dispatch,
      period,
      record: { statement },
    } = this.props;

    const url = fOPNReco.pathToURL(
      `/period/${encodeURIComponent(period.id)}/entry-save`);
    const data = {
      statement_id: statement.id,
      ...entry,
    };
    if (data.id === 'add') {
      data.id = '';
    }
    const promise = this.props.dispatch(fOPNReco.fetch(url, { data }));
    this.editEntry(entry, { saving: true });

    promise.then((response) => {
      const { record, recordURL } = this.props;
      const newEntry = response.entry;
      let newEntries;
      if (entry.id === 'add') {
        newEntries = [...record.entries, response.entry];
      } else {
        newEntries = [];
        for (const e of record.entries) {
          newEntries.push(e.id === newEntry.id ? newEntry : e);
        }
      }
      const newRecord = {
        ...record,
        entries: newEntries,
      };
      dispatch(fetchcache.inject(recordURL, newRecord));
      dispatch(refetchAll());
      this.cancelEntry(entry);
      this.setState({ adding: false });
    }).catch(() => {
      this.editEntry(entry, { saving: false });
    });
  };

  handleCancel = (event) => {
    const entry = this.getEntry(event, true);
    if (!entry) {
      return;
    }

    this.cancelEntry(entry);
  };

  handleDelete = (event) => {
    const entry = this.getEntry(event, true);
    if (!entry) {
      return;
    }

    this.setState({
      deleteExists: true,
      deleteShown: true,
      deleteEntryId: entry.id,
    });
  };

  handleDeleteCancel = () => {
    this.setState({ deleteShown: false });
  };

  handleDeleteConfirmed = () => {
    const entry = this.state.editingEntries[this.state.deleteEntryId];
    if (!entry) {
      // Can this happen?
      return;
    }

    this.setState({ deleting: true });

    const {
      dispatch,
      period,
      record: { statement },
    } = this.props;

    const url = fOPNReco.pathToURL(
      `/period/${encodeURIComponent(period.id)}/entry-delete`);
    const data = {
      id: entry.id,
      statement_id: statement.id,
    };
    const promise = this.props.dispatch(fOPNReco.fetch(url, { data }));
    this.editEntry(entry, { saving: true });

    promise.then(() => {
      const { record, recordURL } = this.props;
      const newEntries = [];
      for (const e of record.entries) {
        if (e.id !== entry.id) {
          newEntries.push(e);
        }
      }
      const newRecord = {
        ...record,
        entries: newEntries,
      };
      dispatch(fetchcache.inject(recordURL, newRecord));
      dispatch(refetchAll());
      this.cancelEntry(entry);
      this.setState({
        deleting: false,
        deleteShown: false,
      });
    }).catch(() => {
      this.editEntry(entry, { saving: false });
      this.setState({
        deleting: false,
        deleteShown: false,
      });
    });
  };

  handleStartAdd = () => {
    this.setState({
      adding: true,
      editingEntries: {
        ...this.state.editingEntries,
        add: {
          id: 'add',
          reco_id: null,
          changed: true,
          entry_date: '',
          delta: '',
          sheet: '',
          row: '',
          description: '',
        },
      },
    });
  };

  /*
   * Focus a specific input field once the DOM element is added,
   * then remove the request for focus.
   */
  refFocus(element, entryId) {
    if (!element) {
      return;
    }

    if (element.focus) {
      element.focus();
    }

    this.setState({
      editingEntries: {
        ...this.state.editingEntries,
        [entryId]: {
          ...this.state.editingEntries[entryId],
          focus: null,
        },
      },
    });
  }

  renderEntry(entry, cfmt) {
    const {
      archived,
      classes,
      period,
      dispatch,
    } = this.props;

    const editableCellProps = {};
    let editing = false;
    let numInputField = null;
    let textInputField = null;
    let { numCell, textCell } = classes;
    if (!period.closed && !archived) {
      editing = this.state.editingEntries[entry.id];
      if (editing) {
        numInputField = classes.numInputField;
        textInputField = classes.textInputField;
        numCell = classes.numCellEditing;
        textCell = classes.textCellEditing;
      } else {
        editableCellProps.onClick = this.handleClickEntry;
      }
    }

    const callRefFocus = (element) => this.refFocus(element, entry.id);

    const main = (
      <tr key={entry.id} data-account-entry-id={entry.id}>
        <td className={textCell} {...editableCellProps} data-name="entry_date">
          {editing ?
            <input
              type="text"
              name="entry_date"
              value={editing.entry_date}
              onChange={this.handleEdit}
              className={textInputField}
              ref={editing.focus === 'entry_date' ? callRefFocus : null}
            />
            :
            <FormattedDate value={entry.entry_date}
              day="numeric" month="short" year="numeric"
              timeZone="UTC" />
          }
        </td>
        <td className={numCell} {...editableCellProps} data-name="delta">
          {editing ?
            <input
              type="text"
              name="delta"
              value={editing.delta}
              onChange={this.handleEdit}
              className={numInputField}
              ref={editing.focus === 'delta' ? callRefFocus : null}
            />
            : cfmt(entry.delta)
          }
        </td>
        <td className={numCell} {...editableCellProps} data-name="sheet">
          {editing ?
            <input
              type="text"
              name="sheet"
              value={editing.sheet}
              onChange={this.handleEdit}
              className={numInputField}
              ref={editing.focus === 'sheet' ? callRefFocus : null}
            />
            : entry.sheet
          }
        </td>
        <td className={numCell} {...editableCellProps} data-name="row">
          {editing ?
            <input
              type="text"
              name="row"
              value={editing.row}
              onChange={this.handleEdit}
              className={numInputField}
              ref={editing.focus === 'row' ? callRefFocus : null}
            />
            : entry.row
          }
        </td>
        <td className={textCell} {...editableCellProps} data-name="description">
          {editing ?
            <input
              type="text"
              name="description"
              value={editing.description}
              onChange={this.handleEdit}
              className={textInputField}
              ref={editing.focus === 'description' ? callRefFocus : null}
            />
            : entry.description
          }
        </td>
        <td className={classes.checkboxCell}>
          {editing && editing.id === 'add' ? null :
            <RecoCheckBox
              periodId={period.id}
              recoId={entry.reco_id}
              accountEntryId={entry.id}
              dispatch={dispatch} />
          }
        </td>
      </tr>
    );

    let controls = null;
    if (editing) {
      const { changed, saving } = editing;
      controls = (
        <tr key={`${entry.id}-controls`}>
          <td colSpan="6" className={classes.saveCell}>
            <FormGroup row>
              <Button
                className={classes.button}
                color="primary"
                variant="contained"
                disabled={!changed || saving}
                data-account-entry-id={entry.id}
                onClick={this.handleSave}
                size="small"
              >
                {entry.id === 'add' ? 'Add' : 'Save Changes'}
              </Button>

              <Button
                className={classes.button}
                color="default"
                variant="contained"
                disabled={saving}
                data-account-entry-id={entry.id}
                onClick={this.handleCancel}
                size="small"
              >
                Cancel
              </Button>

              {entry.id === 'add' ? null :
                <Button
                  className={classes.button}
                  color="default"
                  disabled={saving}
                  data-account-entry-id={entry.id}
                  onClick={this.handleDelete}
                  size="small"
                >
                  Delete
                </Button>
              }

              {saving ?
                <CircularProgress size={24} />
                : null}
            </FormGroup>
          </td>
        </tr>
      );
    }

    return { main, controls };
  }

  render() {
    const {
      archived,
      classes,
      record,
      period,
    } = this.props;

    const rows = [];

    const cfmt = new getCurrencyFormatter(record.statement.currency);

    for (const entry of record.entries) {
      const x = this.renderEntry(entry, cfmt);
      rows.push(x.main);
      if (x.controls) {
        rows.push(x.controls);
      }
    }

    if (!period.closed && !archived) {
      if (this.state.adding) {
        const x = this.renderEntry({ id: 'add' }, cfmt);
        rows.push(x.main);
        if (x.controls) {
          rows.push(x.controls);
        }
      } else {
        rows.push(
          <tr key="add">
            <td colSpan="6" className={classes.addCell}>
              <Fab size="small" color="primary"
                aria-label="Add an account entry"
                onClick={this.handleStartAdd}>
                <Add />
              </Fab>
            </td>
          </tr>
        );
      }
    }

    let deleteDialog = null;
    if (this.state.deleteExists && this.state.deleteEntryId) {
      const entry = this.state.editingEntries[this.state.deleteEntryId];
      if (entry) {
        deleteDialog = (
          <AccountEntryDeleteDialog
            onCancel={this.handleDeleteCancel}
            onDelete={this.handleDeleteConfirmed}
            open={this.state.deleteShown}
            deleting={this.state.deleting} />);
      }
    }

    return (
      <React.Fragment>
        <thead>
          <tr>
            <th className={classes.columnHeadCell} width="15%">
              {deleteDialog}
              Date
            </th>
            <th className={classes.columnHeadCell} width="10%">
              Amount
            </th>
            <th className={classes.columnHeadCell} width="5%">
              Sheet
            </th>
            <th className={classes.columnHeadCell} width="5%">
              Row
            </th>
            <th className={classes.columnHeadCell} width="60%">
              Description
            </th>
            <th className={classes.columnHeadCell} width="5%">
              Reconciled
            </th>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </React.Fragment>
    );
  }
}


export default compose(
  withStyles(styles, { withTheme: true }),
  injectIntl,
)(AccountEntryTableContent);
