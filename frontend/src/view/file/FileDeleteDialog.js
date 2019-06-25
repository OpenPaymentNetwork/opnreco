
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import PropTypes from 'prop-types';
import React from 'react';


class FileDeleteDialog extends React.Component {
  static propTypes = {
    onCancel: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    deleting: PropTypes.bool,
  };

  render() {
    const {
      onCancel,
      onDelete,
      deleting,
      ...otherProps
    } = this.props;

    return (
      <Dialog
        onClose={onCancel}
        aria-labelledby="form-dialog-title"
        {...otherProps}
      >
        <DialogTitle id="form-dialog-title">Delete File</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this file?
            Reconciliation records, periods, and statements will no longer
            be available unless you restore the file.
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


export default FileDeleteDialog;
