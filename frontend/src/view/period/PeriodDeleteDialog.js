
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import PropTypes from 'prop-types';
import React from 'react';


class PeriodDeleteDialog extends React.Component {
  static propTypes = {
    deleteConflicts: PropTypes.object,
    onCancel: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    deleting: PropTypes.bool,
  };

  render() {
    const {
      deleteConflicts,
      onCancel,
      onDelete,
      deleting,
      ...otherProps
    } = this.props;

    if (deleteConflicts) {
      let reason = null;
      if (deleteConflicts.end_date_required) {
        reason = (
          <span>
            The period end date must be set before deletion.
          </span>
        );
      } else if (deleteConflicts.statement_count) {
        reason = (
          <span>
            The period can not be deleted until the statements it contains
            are moved to another period or deleted.
          </span>
        );
      }
      return (
        <Dialog
          onClose={onCancel}
          aria-labelledby="form-dialog-title"
          {...otherProps}
        >
          <DialogTitle id="form-dialog-title">Delete Period</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This period can not currently be deleted. {reason}
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
        <DialogTitle id="form-dialog-title">Delete Period</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this period?
            All account entries and movements will be reassigned
            to other periods.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} color="primary" disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={onDelete} color="primary" disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}


export default PeriodDeleteDialog;
