
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import PropTypes from 'prop-types';
import React from 'react';


class FileRemoveDialog extends React.Component {
  static propTypes = {
    onCancel: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    removing: PropTypes.bool,
  };

  render() {
    const {
      onCancel,
      onRemove,
      removing,
      ...otherProps
    } = this.props;

    return (
      <Dialog
        onClose={onCancel}
        aria-labelledby="form-dialog-title"
        {...otherProps}
      >
        <DialogTitle id="form-dialog-title">Remove File</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove this file?
            Reconciliation records, periods, and statements will no longer
            be available unless you restore the file.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} color="primary" disabled={removing}>
            Cancel
          </Button>
          <Button onClick={onRemove} color="primary" disabled={removing}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}


export default FileRemoveDialog;
