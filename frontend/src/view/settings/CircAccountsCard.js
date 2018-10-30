import { binder } from '../../util/binder';
import { refetchAll } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';


const styles = {
  cardContent: {
    paddingBottom: 0,
  },
};


class CircAccountsCard extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    settings: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {
      checked: {},
      changed: false,
      saving: false,
    };
  }

  handleChangePeer(event, checked) {
    this.setState({changed: true, checked: {
      ...this.state.checked,
      [event.target.value]: checked,
    }});
  }

  handleSave() {
    const {dispatch, settings} = this.props;
    const {checked} = this.state;

    const circ_map = {};
    settings.account_peers.forEach(peer => {
      const {peer_id} = peer;
      let peer_checked;
      if (checked[peer_id] !== undefined) {
        peer_checked = checked[peer_id];
      } else {
        peer_checked = peer.is_circ;
      }
      circ_map[peer_id] = peer_checked;
    });

    const action = fOPNReport.fetchPath(
      '/set-circ-accounts', {data: {circ_map}});

    this.setState({saving: true});

    dispatch(action).then(() => {
      dispatch(refetchAll());
      this.setState({changed: false});
    }).finally(() => {
      this.setState({saving: false});
    });
  }

  render() {
    const {classes, settings} = this.props;
    const {checked, saving, changed} = this.state;

    const accountCheckboxes = settings.account_peers.map(peer => {
      let label;
      if (peer.username) {
        label = <span>{peer.title} (<em>{peer.username}</em>)</span>;
      } else {
        label = peer.title;
      }

      const {peer_id} = peer;
      let peer_checked;
      if (checked[peer_id] !== undefined) {
        peer_checked = checked[peer_id];
      } else {
        peer_checked = peer.is_circ;
      }

      return (
        <div key={peer_id}>
          <FormControlLabel
            control={
              <Checkbox
                checked={peer_checked}
                value={peer_id}
                onChange={this.binder(this.handleChangePeer)} />
            }
            label={label} />
        </div>
      );
    });

    let savingIcon = null;
    if (saving) {
      savingIcon = (
        <CircularProgress size="16px" className={classes.savingIcon} />);
    }

    return (
      <Card className={classes.card}>
        <CardContent className={classes.cardContent}>
          <Typography variant="h6">
            Circulation DFI Accounts (Omnibus Accounts)
          </Typography>
          <Typography variant="body2">
            Select which DFI accounts linked to your profile
            store the value of notes in circulation. Deposits to
            circulation DFI accounts are reported as <em>circulation
            replenishments.</em> (Deposits to non-circulation DFI accounts
            have no effect on circulation.)
          </Typography>
          <Typography variant="body1" component="div">
            {accountCheckboxes}
          </Typography>
        </CardContent>
        <CardActions>
          <Button
            color="primary"
            onClick={this.binder(this.handleSave)}
            disabled={!changed || saving}
          >
            Save Changes
          </Button>
          {savingIcon}
        </CardActions>
      </Card>
    );
  }
}

export default compose(
  withStyles(styles),
  connect(),
)(CircAccountsCard);
