
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import FormHelperText from '@material-ui/core/FormHelperText';
import LayoutConfig from '../app/LayoutConfig';
import LinearProgress from '@material-ui/core/LinearProgress';
import OPNAppBar from '../app/OPNAppBar';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Typography from '@material-ui/core/Typography';


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

  resultsPaper: {
    margin: '16px auto',
    maxWidth: 800,
    padding: '16px',
  },

  field: {
    marginRight: '16px',
    marginBottom: '16px',
  },

  progressBox: {
    padding: '8px 0',
  },

  progressNumber: {
    paddingTop: '8px',
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
      sync_done: 0,
      sync_total: null,
      progress_percent: null,
      change_log: [],
      error: null,
    };
  }

  handleCheckBox = attr => event => {
    this.setState({[attr]: event.target.checked});
  }

  handleText = attr => event => {
    this.setState({[attr]: event.target.value});
  }

  handleVerify = () => {
    const {dispatch} = this.props;
    let verification_id = null;

    const verifyBatch = () => {
      const action = fOPNReco.fetchPath('/verify', {data: {
        verification_id: verification_id,
      }});
      dispatch(action).then(status => {
        verification_id = status.verification_id;
        this.setState({
          sync_done: status.sync_done,
          sync_total: status.sync_total,
          progress_percent: status.progress_percent,
          change_log: [...this.state.change_log, ...(status.change_log || [])],
        });
        if (status.more) {
          verifyBatch();
        } else {
          // Done.
          this.setState({running: false});
        }
      }).catch((error) => {
        this.setState({running: false, error});
      });
    };

    this.setState({
      running: true,
      sync_done: 0,
      sync_total: null,
      progress_percent: null,
      change_log: [],
      error: null,
    });
    verifyBatch();
  }

  renderForm() {
    const {
      classes,
    } = this.props;
    const {state} = this;
    const {running} = state;

    return (
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

        <FormGroup row>
          <Button
            className={classes.button}
            variant="contained"
            onClick={this.handleVerify}
          >
            Verify
          </Button>
        </FormGroup>

        <div style={{height: 1}}></div>
      </Paper>
    );
  }

  renderResults() {
    const {
      classes,
    } = this.props;

    const {state} = this;

    let progress = null;
    if (state.progress_percent != null) {
      let text;

      if (state.sync_done === 1) {
        text = 'transfer verified';
      } else {
        text = 'transfers verified';
      }
      progress = (
        <div className={classes.progressBox}>
          <LinearProgress
            variant="determinate"
            value={state.progress_percent} />
          <Typography variant="body1" className={classes.progressNumber}>
            {state.sync_done || 0} / {state.sync_total} {text} (
            {state.progress_percent}%)
          </Typography>
        </div>
      );
    }

    return (
      <Paper className={classes.resultsPaper}>
        <Typography variant="h6">Results</Typography>
        {progress}
      </Paper>
    );
  }

  render() {
    const {
      classes,
    } = this.props;

    let results = null;
    if (this.state.sync_total || this.state.running) {
      results = this.renderResults();
    }

    return (
      <div className={classes.root}>
        <LayoutConfig title="Verify" />

        <OPNAppBar />

        <div className={classes.content}>
          {this.renderForm()}
          {results}
        </div>
      </div>
    );
  }
}

export default compose(
  withStyles(styles),
  withRouter,
  connect(),
)(Verify);
