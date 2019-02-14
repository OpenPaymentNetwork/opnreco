
import { compose } from '../../util/functional';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Checkbox from '@material-ui/core/Checkbox';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import FormHelperText from '@material-ui/core/FormHelperText';
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from '../app/OPNAppBar';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';


const styles = {
  content: {
  },

  checkboxHelperText: {
    marginTop: '-8px',
  },

  contentPaper: {
    margin: '16px auto',
    maxWidth: 800,
    padding: '16px',
  },

  field: {
    marginRight: '16px',
    marginBottom: '16px',
  },
};


class Verify extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      verifySync: true,
      verifyPeriods: true,
      running: false,
    };
  }

  handleCheckBox = attr => event => {
    this.setState({[attr]: event.target.checked});
  }

  handleText = attr => event => {
    this.setState({[attr]: event.target.value});
  }

  render() {
    const {
      classes,
    } = this.props;

    const {state} = this;

    const {running} = state;

    return (
      <div className={classes.root}>
        <LayoutConfig title="Verify" />

        <OPNAppBar />

        <div className={classes.content}>
          <Paper className={classes.contentPaper}>

            <FormGroup row>

              <FormControl disabled={running} className={classes.field}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={state.verifySync}
                      onChange={this.handleCheckBox('verifySync')}
                    />
                  }
                  label="Verify Transfer Integrity"
                />
                <FormHelperText className={classes.checkboxHelperText}>
                  Test the integrity of transfers already downloaded from OPN.
                </FormHelperText>
              </FormControl>

            </FormGroup>

            <div style={{height: 1}}></div>
          </Paper>
        </div>
      </div>
    );
  }
}

export default compose(
  withStyles(styles),
  withRouter,
)(Verify);
