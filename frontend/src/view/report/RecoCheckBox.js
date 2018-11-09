
import { showRecoPopover } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import ButtonBase from '@material-ui/core/ButtonBase';
import CheckBox from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlank from '@material-ui/icons/CheckBoxOutlineBlank';
import PropTypes from 'prop-types';
import React from 'react';


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
    dispatch: PropTypes.func.isRequired,
    movementId: PropTypes.string.isRequired,
    recoId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.handleClickBound = this.handleClick.bind(this);
  }

  handleClick(event) {
    const {movementId, recoId} = this.props;
    this.props.dispatch(showRecoPopover({
      movementId,
      recoId,
      anchorEl: event.target,
    }));
  }

  render() {
    const {classes, recoId} = this.props;
    let Icon, hiddenText;

    if (recoId !== null) {
      Icon = CheckBox;
      hiddenText = 'YES';
    } else {
      Icon = CheckBoxOutlineBlank;
      hiddenText = '___';
    }
    return (
      <React.Fragment>
        <span className={classes.hiddenText}>{hiddenText}</span>
        <ButtonBase
          centerRipple
          onClick={this.handleClickBound}
          className={classes.button}
        >
          <Icon />
        </ButtonBase>
      </React.Fragment>
    );
  }
}


export default withStyles(styles)(RecoCheckBox);
