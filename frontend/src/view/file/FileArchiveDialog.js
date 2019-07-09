
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import PropTypes from 'prop-types';
import React from 'react';


class FileArchiveDialog extends React.Component {
  static propTypes = {
    onCancel: PropTypes.func.isRequired,
    onArchive: PropTypes.func.isRequired,
    archiving: PropTypes.bool,
  };

  render() {
    const {
      onCancel,
      onArchive,
      archiving,
      ...otherProps
    } = this.props;

    return (
      <Dialog
        onClose={onCancel}
        aria-labelledby="form-dialog-title"
        {...otherProps}
      >
        <DialogTitle id="form-dialog-title">Archive File</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to archive this file?
            (Files can not be changed while archived, but they can be
            unarchived.)
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} color="primary" disabled={archiving}>
            Cancel
          </Button>
          <Button onClick={onArchive} color="primary" disabled={archiving}>
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}


export default FileArchiveDialog;
