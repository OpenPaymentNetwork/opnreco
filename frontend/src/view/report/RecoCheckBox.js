
import { showRecoPopover } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import ButtonBase from '@material-ui/core/ButtonBase';
import CheckBox from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlank from '@material-ui/icons/CheckBoxOutlineBlank';
import PropTypes from 'prop-types';
import React from 'react';


const styles = {
  root: {
    cursor: 'pointer',
    width: '32px',
    height: '32px',
  },
};


class RecoCheckBox extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    movementId: PropTypes.string.isRequired,
    recoId: PropTypes.string,
    recoInternal: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.handleClickBound = this.handleClick.bind(this);
  }

  handleClick(event) {
    const {movementId, recoId, recoInternal} = this.props;
    this.props.dispatch(showRecoPopover({
      movementId,
      recoId,
      recoInternal,
      anchorEl: event.target,
    }));
  }

  render() {
    const {classes, recoId} = this.props;
    let Icon;

    if (recoId !== null) {
      Icon = CheckBox;
    } else {
      Icon = CheckBoxOutlineBlank;
    }
    return (
      <ButtonBase
        centerRipple
        onClick={this.handleClickBound}
        className={classes.root}
      >
        <Icon />
      </ButtonBase>);
  }
}


export default withStyles(styles)(RecoCheckBox);
