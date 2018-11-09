
import { binder } from '../../util/binder';
import { closeRecoPopover } from '../../reducer/report';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReport } from '../../util/fetcher';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Close from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import IconButton from '@material-ui/core/IconButton';
import Popover from '@material-ui/core/Popover';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const styles = theme => ({
  popoverContent: {
    minWidth: '400px',
  },
  titleBar: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    paddingLeft: '16px',
    fontSize: '1.0rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    color: '#fff',
  },
  content: {
    padding: '16px',
  },
  actionBox: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '0 16px 16px 16px',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  headCell: {
    border: '1px solid #bbb',
    backgroundColor: '#ddd',
    fontWeight: 'normal',
  },
  head2Cell: {
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  spaceRow: {
    height: '16px',
  },
  cell: {
    border: '1px solid #bbb',
  },
  checkCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  searchCell: {
    border: '1px solid #bbb',
  },
});


class RecoPopover extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    open: PropTypes.bool,
    anchorEl: PropTypes.object,
    recoId: PropTypes.string,
    recoURL: PropTypes.string.isRequired,
    reco: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleClose() {
    this.props.dispatch(closeRecoPopover());
  }

  renderTable() {
    const {
      classes,
    } = this.props;

    return (
      <table className={classes.table}>
        <tbody>
          <tr>
            <th colSpan="4" className={classes.headCell}>Movements</th>
          </tr>
          <tr>
            <th width="10%" className={classes.checkCell}>
              <input type="checkbox" />
            </th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date and Time</th>
            <th width="30%" className={classes.head2Cell}>Transfer</th>
          </tr>
          <tr>
            <td colSpan="4" className={classes.searchCell}></td>
          </tr>
          <tr>
            <td colSpan="4" className={classes.spaceRow}></td>
          </tr>
          <tr>
            <th colSpan="4"className={classes.headCell}>Account Entries</th>
          </tr>
          <tr>
            <th width="10%" className={classes.checkCell}>
              <input type="checkbox" />
            </th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date</th>
            <th width="30%" className={classes.head2Cell}>Description</th>
          </tr>
          <tr>
            <td colSpan="4" className={classes.searchCell}></td>
          </tr>
        </tbody>
      </table>
    );
  }

  render() {
    const {
      classes,
      open,
      anchorEl,
      recoId,
      recoURL,
      reco,
    } = this.props;

    return (
      <Popover
        id="reco-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={this.binder(this.handleClose)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        TransitionComponent={Fade}
      >
        <Require urls={[recoURL]} fetcher={fOPNReport} />
        <div className={classes.popoverContent}>
          <Typography variant="h6" className={classes.titleBar}>
            <span className={classes.popoverTitle}>Reconciliation {recoId}</span>
            <IconButton
              className={classes.closeButton}
              onClick={this.binder(this.handleClose)}
            >
              <Close />
            </IconButton>
          </Typography>
          <Typography className={classes.content} component="div">
            {reco ? this.renderTable() : <CircularProgress />}
          </Typography>
          <div className={classes.actionBox}>
            {recoId ?
              <Button>Remove</Button>
              : null}
            <Button color="primary">Save</Button>
          </div>
        </div>
      </Popover>
    );
  }
}


function mapStateToProps(state) {
  const {recoPopover} = state.report;
  const {recoId, movementId, accountEntryId} = recoPopover;
  const query = (
    `movement_id=${encodeURIComponent(movementId || '')}&` +
    `reco_id=${encodeURIComponent(recoId || '')}&` +
    `account_entry_id=${encodeURIComponent(accountEntryId || '')}`);
  const recoURL = fOPNReport.pathToURL(`/reco?${query}`);
  const reco = fetchcache.get(state, recoURL);
  return {
    ...recoPopover,
    recoURL,
    reco,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  connect(mapStateToProps),
)(RecoPopover);
