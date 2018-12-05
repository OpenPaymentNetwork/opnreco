
import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { injectIntl, intlShape } from 'react-intl';
import { renderReportDateString } from '../../util/reportrender';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from '../app/OPNAppBar';
import PropTypes from 'prop-types';
import React from 'react';
import CircularProgress from '@material-ui/core/CircularProgress';
import Require from '../../util/Require';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import FormGroup from '@material-ui/core/FormGroup';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import Lock from '@material-ui/icons/Lock';
import LockOpen from '@material-ui/icons/LockOpen';
import Checkbox from '@material-ui/core/Checkbox';


const tableWidth = '800px';

const styles = {
  content: {
    padding: '16px',
  },
  paperContent: {
    maxWidth: tableWidth,
    margin: '0 auto',
    padding: '16px',
  },
  field: {
    margin: '16px 16px 16px 0',
    minWidth: '250px',
  },
  saveButton: {
    margin: '16px 16px 16px 0',
  },
  lockSelection: {
    display: 'flex',
    alignItems: 'center',
  },
  lockSelectionText: {
    display: 'block',
    marginLeft: '8px',
  },
};


class FileView extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    intl: intlShape.isRequired,
    loading: PropTypes.bool,
    queryURL: PropTypes.string.isRequired,
    result: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      form: {},
    };
  }

  componentDidMount() {
    this.componentDidUpdate();
  }

  componentDidUpdate() {
    const {result} = this.props;
    if (!this.state.initialized && result) {
      this.setState({
        form: result.file,
        initialized: true,
      });
    }
  }

  handleChangeText(fieldName, event) {
    this.setState({
      form: {
        ...this.state.form,
        [fieldName]: event.target.value,
      },
      changed: true,
    });
  }

  handleChangeLocked(event) {
    this.setState({
      form: {
        ...this.state.form,
        locked: event.target.value === 'locked',
      },
      changed: true,
    });
  }

  handleChangeReassign(event) {
    this.setState({
      form: {
        ...this.state.form,
        reassign: event.target.checked,
      },
    });
  }

  renderForm() {
    const {
      classes,
    } = this.props;

    const {
      form,
      changed,
    } = this.state;

    const locked = form.locked;

    return (
      <Paper className={classes.paperContent}>
        <form className={classes.form} noValidate>
          <FormGroup row>
            <FormControl className={classes.field}>
              <InputLabel htmlFor="locked-select">File State</InputLabel>
              <Select
                value={form.locked ? 'locked' : 'unlocked'}
                onChange={this.binder(this.handleChangeLocked)}
                input={<Input name="locked" id="locked-select" />}
              >
                <MenuItem value="unlocked">
                  <div className={classes.lockSelection}>
                    <LockOpen/>
                    <span className={classes.lockSelectionText}>Unlocked</span>
                  </div>
                </MenuItem>
                <MenuItem value="locked">
                  <div className={classes.lockSelection}>
                    <Lock />
                    <span className={classes.lockSelectionText}>Locked</span>
                  </div>
                </MenuItem>
              </Select>
            </FormControl>

          </FormGroup>
          <FormGroup row>

            <TextField
              id="start_date"
              label="Start Date"
              type="date"
              value={form.start_date || ''}
              onChange={this.binder1(this.handleChangeText, 'start_date')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={locked}
            />

            <TextField
              id="end_date"
              label="End Date"
              type="date"
              value={form.end_date || ''}
              onChange={this.binder1(this.handleChangeText, 'end_date')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={locked}
            />
          </FormGroup>

          <FormGroup row>
            <TextField
              id="start_circ"
              label="Circulation on Start Date"
              value={form.start_circ || ''}
              onChange={this.binder1(this.handleChangeText, 'start_circ')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={locked}
            />

            <TextField
              id="start_surplus"
              label="Surplus/Deficit on Start Date"
              value={form.start_surplus || ''}
              onChange={this.binder1(this.handleChangeText, 'start_surplus')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={locked}
            />
          </FormGroup>

          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.reassign}
                  onChange={this.binder(this.handleChangeReassign)}
                  disabled={locked}
                />
              }
              label={
                <div>
                  Reassign account entries and movements based on
                  the new date range.
                </div>
              }
            />
          </FormGroup>

          <FormGroup row>
            <Button
              className={classes.saveButton}
              color="primary"
              variant="contained"
              disabled={!changed}
            >
              Save Changes
            </Button>
          </FormGroup>
        </form>
      </Paper>
    );
  }

  renderContent() {
    return this.renderForm();
  }

  render() {
    const {
      classes,
      queryURL,
      result,
      loading,
      intl,
    } = this.props;

    const titleParts = [];
    let content = null;

    if (result) {
      let peerType;
      if (result.file.peer_id === 'c') {
        peerType = 'Circulation';
      } else if (result.peer.is_dfi_account) {
        peerType = 'DFI Account';
      } else {
        peerType = 'Wallet';
      }

      titleParts.push('File:');
      titleParts.push(renderReportDateString(result.file, result.now, intl));
      titleParts.push('-');
      titleParts.push(result.peer.title);
      titleParts.push(`(${peerType})`);
      titleParts.push('-');
      titleParts.push(result.file.currency);
      titleParts.push(
        result.file.loop_id === '0' ? 'Open Loop' : result.loop.title);
      content = this.renderContent();
    } else if (loading) {
      titleParts.push('File');
      content = (
        <div style={{textAlign: 'center'}}>
          <CircularProgress style={{padding: '16px'}} />
        </div>);
    } else {
      titleParts.push('File not found');
    }

    return (
      <div className={classes.root}>
        <LayoutConfig title={titleParts.join(' ')} perOwner />
        <Require fetcher={fOPNReco} urls={[queryURL]} />

        <OPNAppBar />

        <div className={classes.content}>
          {content}
          <div style={{height: 1}}></div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  const {match} = ownProps;
  const queryURL = fOPNReco.pathToURL(
    `/file?file_id=${encodeURIComponent(match.params.file_id)}`);
  const result = fetchcache.get(state, queryURL);
  const loading = fetchcache.fetching(state, queryURL);

  return {
    result,
    queryURL,
    loading,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  injectIntl,
  connect(mapStateToProps),
)(FileView);
