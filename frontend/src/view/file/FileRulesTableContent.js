
import { refetchAll } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withStyles } from '@material-ui/core/styles';
import FileRuleDeleteDialog from './FileRuleDeleteDialog';
import Add from '@material-ui/icons/Add';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Fab from '@material-ui/core/Fab';
import FormGroup from '@material-ui/core/FormGroup';
import PropTypes from 'prop-types';
import React from 'react';


const styles = theme => ({
  textCell: {
    textAlign: 'left',
    padding: '8px',
    border: '1px solid #bbb',
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.9rem',
    lineHeight: '16px',
    cursor: 'text',
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
  textInputField: {
    border: 'none',
    color: '#000',
    padding: '8px',
    width: '100%',
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.9rem',
    lineHeight: '16px',
  },
});


class FileRulesTableContent extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    file: PropTypes.object.isRequired,
    items: PropTypes.array.isRequired,
    itemsURL: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      // editing: {rule_id: {changed, saving, focus, ...fields}}
      editing: {},
    };
  }

  getItem(event, fromState) {
    let element = event.target;

    let itemId = null;
    while (element) {
      itemId = element.getAttribute('data-item-id');
      if (itemId) {
        break;
      } else {
        element = element.parentElement;
      }
    }

    if (!itemId) {
      return null;
    }

    if (fromState) {
      return this.state.editing[itemId];
    } else {
      for (const item of this.props.items) {
        if (item.id === itemId) {
          return item;
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

  handleClickItem = (event) => {
    const item = this.getItem(event);

    if (!item || this.state.editing[item.id]) {
      return;
    }

    this.setState({
      editing: {
        ...this.state.editing,
        [item.id]: {
          id: item.id,
          changed: false,
          saving: false,
          focus: this.getName(event),
          self_id: item.self_id,
          peer_id: item.peer_id,
          loop_id: item.loop_id,
        },
      },
    });
  }

  editItem(item, changes) {
    this.setState({
      editing: {
        ...this.state.editing,
        [item.id]: {
          ...item,
          ...changes,
        },
      },
    });
  }

  cancelItem(item) {
    this.setState({
      adding: false,
      editing: {
        ...this.state.editing,
        [item.id]: undefined,
      },
    });
  }

  handleEdit = (event) => {
    const item = this.getItem(item, true);
    if (!item) {
      return;
    }

    this.editItem(item, {
      changed: true,
      [event.target.name]: event.target.value,
    });
  }

  handleSave = (event) => {
    const item = this.getItem(event, true);
    if (!item) {
      return;
    }

    const {
      dispatch,
      file,
    } = this.props;

    const url = fOPNReco.pathToURL(
      `/file/${encodeURIComponent(file.id)}/rule-save`);
    const data = {
      ...item,
    };
    if (data.id === 'add') {
      data.id = '';
    }
    const promise = dispatch(fOPNReco.fetch(url, {data}));
    this.editItem(item, {saving: true});

    promise.then((response) => {
      const rules = response.rules;
      const {itemsURL} = this.props;
      dispatch(fetchcache.inject(itemsURL, rules));
      dispatch(refetchAll());
      this.cancelItem(item);
      this.setState({adding: false});
    }).catch(() => {
      this.editItem(item, {saving: false});
    });
  }

  handleCancel = (event) => {
    const item = this.getItem(event, true);
    if (!item) {
      return;
    }

    this.cancelItem(item);
  }

  handleDelete = (event) => {
    const item = this.getItem(event, true);
    if (!item) {
      return;
    }

    this.setState({
      deleteExists: true,
      deleteShown: true,
      deleteItemId: item.id,
    });
  }

  handleDeleteCancel = () => {
    this.setState({deleteShown: false, deleteItemId: null});
  }

  handleDeleteConfirmed = () => {
    const item = this.state.editing[this.state.deleteItemId];
    if (!item) {
      // Can this happen?
      return;
    }

    this.setState({deleting: true});

    const {
      dispatch,
      file,
    } = this.props;

    const url = fOPNReco.pathToURL(
      `/file/${encodeURIComponent(file.id)}/rule-delete`);
    const data = {
      id: item.id,
    };
    const promise = dispatch(fOPNReco.fetch(url, {data}));
    this.editItem(item, {saving: true});

    promise.then((response) => {
      const rules = response.rules;
      const {itemsURL} = this.props;
      dispatch(fetchcache.inject(itemsURL, rules));
      dispatch(refetchAll());
      this.cancelItem(item);
      this.setState({
        deleting: false,
        deleteShown: false,
      });
    }).catch(() => {
      this.editItem(item, {saving: false});
      this.setState({
        deleting: false,
        deleteShown: false,
      });
    });
  }

  handleStartAdd = () => {
    this.setState({
      adding: true,
      editing: {
        ...this.state.editing,
        add: {
          id: 'add',
          changed: true,
          self_id: '',
          peer_id: '',
          loop_id: '0',
        },
      },
    });
  }

  /*
   * Focus a specific input field once the DOM element is added,
   * then remove the request for focus.
   */
  refFocus(element, itemId) {
    if (!element) {
      return;
    }

    if (element.focus) {
      element.focus();
    }

    this.setState({
      editing: {
        ...this.state.editing,
        [itemId]: {
          ...this.state.editing[itemId],
          focus: null,
        },
      },
    });
  }

  renderItem(item) {
    const {
      classes,
    } = this.props;

    const editableCellProps = {};
    let editing = false;
    let textInputField = null;
    let {textCell} = classes;
    editing = this.state.editing[item.id];
    if (editing) {
      textInputField = classes.textInputField;
      textCell = classes.textCellEditing;
    } else {
      editableCellProps.onClick = this.handleClickItem;
    }

    const callRefFocus = (element) => this.refFocus(element, item.id);

    const main = (
      <tr key={item.id} data-item-id={item.id}>
        <td className={textCell} {...editableCellProps} data-name="self_id">
          {editing ?
            <input
              type="text"
              name="self_id"
              value={editing.self_id}
              onChange={this.handleEdit}
              className={textInputField}
              ref={editing.focus === 'self_id' ? callRefFocus : null}
            />
            :
            item.self_id
          }
        </td>
        <td className={textCell} {...editableCellProps} data-name="peer_id">
          {editing ?
            <input
              type="text"
              name="peer_id"
              value={editing.peer_id}
              onChange={this.handleEdit}
              className={textInputField}
              ref={editing.focus === 'peer_id' ? callRefFocus : null}
            />
            :
            item.peer_id
          }
        </td>
        <td className={textCell} {...editableCellProps} data-name="loop_id">
          {editing ?
            <input
              type="text"
              name="loop_id"
              value={editing.loop_id}
              onChange={this.handleEdit}
              className={textInputField}
              ref={editing.focus === 'loop_id' ? callRefFocus : null}
            />
            :
            item.loop_id
          }
        </td>
      </tr>
    );

    let controls = null;
    if (editing) {
      const {changed, saving} = editing;
      controls = (
        <tr key={`${item.id}-controls`}>
          <td colSpan="6" className={classes.saveCell}>
            <FormGroup row>
              <Button
                className={classes.button}
                color="primary"
                variant="contained"
                disabled={!changed || saving}
                data-item-id={item.id}
                onClick={this.handleSave}
                size="small"
              >
                {item.id === 'add' ? 'Add' : 'Save Changes'}
              </Button>

              <Button
                className={classes.button}
                color="default"
                variant="contained"
                disabled={saving}
                data-item-id={item.id}
                onClick={this.handleCancel}
                size="small"
              >
                Cancel
              </Button>

              {item.id === 'add' ? null :
                <Button
                  className={classes.button}
                  color="default"
                  disabled={saving}
                  data-item-id={item.id}
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

    return {main, controls};
  }

  render() {
    const {
      classes,
      items,
    } = this.props;

    const rows = [];

    for (const item of items) {
      const x = this.renderItem(item);
      rows.push(x.main);
      if (x.controls) {
        rows.push(x.controls);
      }
    }

    if (this.state.adding) {
      const x = this.renderItem({id: 'add'});
      rows.push(x.main);
      if (x.controls) {
        rows.push(x.controls);
      }
    } else {
      rows.push(
        <tr key="add">
          <td colSpan="6" className={classes.addCell}>
            <Fab size="small" color="primary"
              aria-label="Add a rule"
              onClick={this.handleStartAdd}>
              <Add />
            </Fab>
          </td>
        </tr>
      );
    }

    let deleteDialog = null;
    if (this.state.deleteExists && this.state.deleteItemId) {
      const item = this.state.editing[this.state.deleteItemId];
      if (item) {
        deleteDialog = (
          <FileRuleDeleteDialog
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
            <th className={classes.columnHeadCell} width="33%">
              {deleteDialog}
              Wallet Holder
            </th>
            <th className={classes.columnHeadCell} width="33%">
              Peer
            </th>
            <th className={classes.columnHeadCell} width="34%">
              Note Design
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
  withStyles(styles, {withTheme: true}),
)(FileRulesTableContent);
