
import { allCurrencies } from '../../util/currency';
import { clearWithFiles } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { triggerResync } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';


const styles = {
  content: {
    padding: '16px',
    maxWidth: '800px',
    margin: '16px auto',
  },
  field: {
    margin: '16px 16px 16px 0',
    minWidth: '320px',
  },
  button: {
    margin: '16px 16px 16px 0',
  },
  progress: {
    marginLeft: '16px',
  },
  addTopLine: {
    marginTop: '0',
  },
  formLine: {
    marginTop: '16px',
  },
};


class FileAddForm extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    onCancel: PropTypes.func,
    ownerTitle: PropTypes.string,
    peerContentURL: PropTypes.string.isRequired,
    peerContent: PropTypes.object,
    peerContentLoading: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      form: {
        currency: 'USD',
        auto_enable_loops: true,
      },
    };
  }

  handleChangeText = (event, fieldName) => {
    this.setState({
      form: {
        ...this.state.form,
        [fieldName]: event.target.value,
      },
    });
  }

  handleChangeAutoEnableLoops = (event) => {
    this.setState({
      form: {
        ...this.state.form,
        auto_enable_loops: event.target.checked,
      },
    });
  }

  handleAdd = () => {
    const {
      dispatch,
      history,
    } = this.props;
    const url = fOPNReco.pathToURL('/file/add');
    const data = {
      ...this.state.form,
      title: this.getTitle(),
    };
    const promise = dispatch(fOPNReco.fetch(url, {data}));
    this.setState({saving: true});
    promise.then((response) => {
      dispatch(clearWithFiles());
      dispatch(triggerResync());
      history.push(`/file/${encodeURIComponent(response.file.id)}`);
    }).catch(() => {
      this.setState({saving: false});
    });
  }

  getTitle() {
    let title = this.state.form.title;
    if (title) {
      return title;
    }

    const file_type = this.state.form.file_type;

    if (file_type) {
      if (file_type === 'open_circ') {
        return 'Open Loop Circulation';
      } else if (file_type === 'closed_circ') {
        return 'Closed Loop Circulation';
      } else if (file_type === 'account') {
        const peer_id = this.state.form.peer_id;
        if (peer_id) {
          const peer = this.props.peerContent.peers[peer_id];
          if (peer && peer.title) {
            return `Account ${peer.title}`;
          }
        }
      }
    }

    return '';
  }

  render() {
    const {
      classes,
      onCancel,
      ownerTitle,
      peerContent,
      peerContentURL,
    } = this.props;

    const {
      form,
      saving,
    } = this.state;

    let spinner = null;
    if (saving) {
      spinner = <CircularProgress size="24px" className={classes.progress} />;
    }

    let topLine;
    let buttons;
    buttons = (
      <FormGroup row>
        <Button
          className={classes.button}
          color="primary"
          variant="contained"
          onClick={this.handleAdd}
        >
          Add
        </Button>

        {onCancel ?
          <Button
            className={classes.button}
            variant="contained"
            onClick={this.props.onCancel}
          >
            Cancel
          </Button>
          : null}

        {spinner}
      </FormGroup>
    );

    topLine = (
      <Typography variant="h6" className={classes.addTopLine}>
        Add a Reconciliation File {ownerTitle ? `for ${ownerTitle}` : ''}
      </Typography>
    );

    let accountSelect = null;

    if (!form.file_type || form.file_type === 'account') {
      let selections = null;
      if (peerContent) {
        if (peerContent.peer_order.length) {
          selections = peerContent.peer_order.map(peerId => (
            <MenuItem value={peerId} key={peerId}>
              {peerContent.peers[peerId].title}
            </MenuItem>
          ));
        } else if (form.file_type === 'account') {
          selections = (
            <MenuItem value="">
              <em>No accounts found for your profile.</em>
            </MenuItem>
          );
        }
      }
      accountSelect = (
        <FormGroup row className={classes.formLine}>
          <FormControl disabled={form.file_type !== 'account'}>
            <InputLabel shrink htmlFor="peer_id">
              Account
            </InputLabel>
            <Select
                id="peer_id"
                name="peer_id"
                value={form.peer_id || ''}
                onChange={(event) => this.handleChangeText(event, 'peer_id')}
                className={classes.field}
                displayEmpty>
              {selections}
            </Select>
          </FormControl>
        </FormGroup>
      );
    }

    return (
      <Paper className={classes.content}>
        <Require fetcher={fOPNReco} urls={[peerContentURL]} />

        <form className={classes.form} noValidate>
          <FormGroup row>
            {topLine}
          </FormGroup>

          <FormGroup row className={classes.formLine}>
            <FormControl>
              <InputLabel shrink htmlFor="file_type">
                Type
              </InputLabel>
              <Select
                  id="file_type"
                  name="file_type"
                  value={form.file_type || ''}
                  onChange={(event) => this.handleChangeText(event, 'file_type')}
                  className={classes.field}>
                <MenuItem value="open_circ">Open Loop Circulation</MenuItem>
                <MenuItem value="closed_circ">Closed Loop Circulation</MenuItem>
                <MenuItem value="account">Personal or Business Account</MenuItem>
              </Select>
            </FormControl>
          </FormGroup>

          <FormGroup row className={classes.formLine}>
            <FormControl>
              <InputLabel shrink htmlFor="currency">
                Currency
              </InputLabel>
              <Select
                  id="currency"
                  name="currency"
                  value={form.currency || ''}
                  onChange={(event) => this.handleChangeText(event, 'currency')}
                  className={classes.field}>
                {allCurrencies.map(currency => (
                  <MenuItem value={currency} key={currency}>
                    {currency}
                  </MenuItem>))}
              </Select>
            </FormControl>
          </FormGroup>

          {accountSelect}

          <FormGroup row>
            <TextField
              id="title"
              label="Title"
              value={this.getTitle()}
              onChange={(event) => this.handleChangeText(event, 'title')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </FormGroup>

          {form.file_type === 'closed_circ' ?
            <FormGroup row>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.auto_enable_loops || false}
                    onChange={this.handleChangeAutoEnableLoops}
                  />
                }
                label={
                  <div>
                    Automatically enable the reconciliation of all
                    newly discovered closed loop note designs
                  </div>
                }
              />
            </FormGroup>
          : null}

          {buttons}
        </form>
      </Paper>
    );
  }
}

function mapStateToProps(state) {
  const peerContentURL = fOPNReco.pathToURL('/file/account_peers');
  const peerContent = fetchcache.get(state, peerContentURL);
  const peerContentLoading = fetchcache.fetching(state, peerContentURL);

  return {
    peerContent,
    peerContentURL,
    peerContentLoading,
  };
}

export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(FileAddForm);
