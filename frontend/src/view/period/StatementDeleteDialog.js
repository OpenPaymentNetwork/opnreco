
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import PropTypes from 'prop-types';
import React from 'react';


class StatementDeleteDialog extends React.Component {
  static propTypes = {
    statementId: PropTypes.string.isRequired,
    deleteConflicts: PropTypes.number.isRequired,
    onCancel: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
  };

  render() {
    const {
      statementId,
      deleteConflicts,
      onCancel,
      onDelete,
      ...otherProps
    } = this.props;

    if (deleteConflicts) {
      let reason;
      if (deleteConflicts === 1) {
        reason = (
          <span>
            an account entry in this statement belongs to a closed period
          </span>
        );
      } else {
        reason = (
          <span>
            {deleteConflicts} account entries in this statement belong
            to a closed period
          </span>
        );
      }
      return (
        <Dialog
          onClose={onCancel}
          aria-labelledby="form-dialog-title"
          {...otherProps}
        >
          <DialogTitle id="form-dialog-title">Delete Statement</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This statement can not currently be deleted because {reason}.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      );
    }

    return (
      <Dialog
        onClose={onCancel}
        aria-labelledby="form-dialog-title"
        {...otherProps}
      >
        <DialogTitle id="form-dialog-title">Delete Statement</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete statement {statementId}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={onDelete} color="primary">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}


export default StatementDeleteDialog;
