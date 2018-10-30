
import { showRecoPopup } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import CheckBox from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlank from '@material-ui/icons/CheckBoxOutlineBlank';
import PropTypes from 'prop-types';
import React from 'react';


const styles = {
  root: {
    cursor: 'pointer',
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
    this.props.dispatch(showRecoPopup({
      movementId,
      recoId,
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
      <React.Fragment>
        <Icon
          className={classes.root}
          onClick={this.handleClickBound} />
      </React.Fragment>);
  }
}


export default withStyles(styles)(RecoCheckBox);
