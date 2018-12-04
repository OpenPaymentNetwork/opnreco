
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
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';


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

  handleChangeClosed(event) {
    this.setState({
      form: {
        ...this.state.form,
        closed: event.target.value === 'closed',
      },
      changed: true,
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

    const closed = form.closed;

    return (
      <Paper className={classes.paperContent}>
        <form className={classes.form} noValidate>
          <FormGroup row>
            <FormControl className={classes.field}>
              <InputLabel htmlFor="closed-select">File State</InputLabel>
              <Select
                value={form.closed ? 'closed' : 'open'}
                onChange={this.binder(this.handleChangeClosed)}
                input={<Input name="closed" id="closed-select" />}
              >
                <MenuItem value="open">Open - accept changes</MenuItem>
                <MenuItem value="closed">
                  Closed - prevent changes
                </MenuItem>
              </Select>
            </FormControl>

          </FormGroup>
          <FormGroup row>

            <TextField
              id="start_date"
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={this.binder1(this.handleChangeText, 'start_date')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={closed}
            />

            <TextField
              id="end_date"
              label="End Date"
              type="date"
              value={form.end_date}
              onChange={this.binder1(this.handleChangeText, 'end_date')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={closed}
            />
          </FormGroup>

          <FormGroup row>
            <TextField
              id="start_circ"
              label="Circulation on Start Date"
              value={form.start_circ}
              onChange={this.binder1(this.handleChangeText, 'start_circ')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={closed}
            />

            <TextField
              id="start_surplus"
              label="Surplus/Deficit on Start Date"
              value={form.start_surplus}
              onChange={this.binder1(this.handleChangeText, 'start_surplus')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={closed}
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
        <LayoutConfig title={titleParts.join(' ')} />
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
