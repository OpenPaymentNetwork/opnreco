
import { withStyles } from '@material-ui/core/styles';
import ButtonBase from '@material-ui/core/ButtonBase';
import CheckBox from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlank from '@material-ui/icons/CheckBoxOutlineBlank';
import PropTypes from 'prop-types';
import React from 'react';
import RecoPopover from '../recopop/RecoPopover';


const styles = {
  button: {
    width: '32px',
    height: '32px',
  },
  hiddenText: {
    // The hidden text is revealed when copying and pasting to Google Sheets.
    position: 'absolute',
    top: 0,
    left: '-10000px',
  },
};


class RecoCheckBox extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    movementId: PropTypes.string,
    accountEntryId: PropTypes.string,
    recoId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    // Implicit state: open, popupExists, anchorEl
    // There's no need to initialize the implicit state.
    this.state = {};
  }

  handleClick(event) {
    this.setState({
      open: true,
      popupExists: true,
      anchorEl: event.target,
    });
  }

  handleCloseDialog() {
    this.setState({
      open: false,
    });
  }

  render() {
    const {
      classes,
      recoId,
    } = this.props;

    const {
      open,
      popupExists,
      anchorEl,
    } = this.state;

    let Icon, hiddenText;

    if (recoId !== null) {
      Icon = CheckBox;
      hiddenText = 'YES';
    } else {
      Icon = CheckBoxOutlineBlank;
      hiddenText = '___';
    }

    let popup = null;

    if (popupExists) {
      const {
        movementId,
        accountEntryId,
      } = this.props;

      let closeDialogBound = this.handleCloseDialogBound;
      if (!closeDialogBound) {
        closeDialogBound = this.handleCloseDialog.bind(this);
        this.handleCloseDialogBound = closeDialogBound;
      }

      popup = (
        <RecoPopover
          recoId={recoId}
          movementId={movementId}
          accountEntryId={accountEntryId}
          anchorEl={anchorEl}
          open={open}
          closeDialog={closeDialogBound}
        />
      );
    }

    let clickBound = this.handleClickBound;
    if (!clickBound) {
      clickBound = this.handleClick.bind(this);
      this.handleClickBound = clickBound;
    }

    return (
      <React.Fragment>
        <span className={classes.hiddenText}>{hiddenText}</span>
        <ButtonBase
          centerRipple
          onClick={clickBound}
          className={classes.button}
        >
          <Icon />
        </ButtonBase>
        {popup}
      </React.Fragment>
    );
  }
}


export default withStyles(styles)(RecoCheckBox);
