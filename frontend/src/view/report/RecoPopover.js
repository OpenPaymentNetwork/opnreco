
import { binder, binder1 } from '../../util/binder';
import { closeRecoPopover } from '../../reducer/report';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { dashed } from '../../util/transferfmt';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReport } from '../../util/fetcher';
import { FormattedDate, FormattedTime } from 'react-intl';
import { getCurrencyDeltaFormatter } from '../../util/currency';
import { getPloopAndFile } from '../../util/ploopfile';
import { throttler } from '../../util/throttler';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import AddCircle from '@material-ui/icons/AddCircle';
import Button from '@material-ui/core/Button';
import RemoveCircle from '@material-ui/icons/RemoveCircle';
import CircularProgress from '@material-ui/core/CircularProgress';
import Close from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import Popover from '@material-ui/core/Popover';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Search from '@material-ui/icons/Search';
import Typography from '@material-ui/core/Typography';


const styles = theme => ({
  popoverContent: {
    minWidth: '700px',
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
    justifyContent: 'space-between',
    padding: '0 16px 16px 16px',
  },
  actionLeftButtons: {
    flexGrow: 2,
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  headCell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  head2Cell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  spaceRow: {
    height: '16px',
  },
  cell: {
    border: '1px solid #bbb',
  },
  actionCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  actionHeadCell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  removeIcon: {
    cursor: 'pointer',
    color: '#777',
    display: 'block',
    margin: '0 auto',
  },
  removableRow: {
    transition: 'opacity 200ms ease',
  },
  removingRow: {
    opacity: 0,
  },
  numberCell: {
    border: '1px solid #bbb',
    padding: '2px 8px',
    textAlign: 'right',
  },
  searchCell: {
    border: '1px solid #bbb',
    padding: '0 8px',
  },
  searchHeadCell: {
    paddingTop: '2px',
    textAlign: 'center',
  },
  searchIcon: {
    color: '#777',
    display: 'block',
    margin: '0 auto',
  },
  searchCloseIcon: {
    color: '#777',
    display: 'block',
    margin: '0 auto',
    cursor: 'pointer',
  },
  searchInput: {
    padding: 0,
  },
  searchWorkingCell: {
    border: '1px solid #bbb',
  },
  searchWorkingIcon: {
    display: 'block',
    margin: '2px auto',
  },
  searchEmptyCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
    padding: '4px 8px',
    fontStyle: 'italic',
  },
});


class RecoPopover extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    open: PropTypes.bool,
    anchorEl: PropTypes.object,
    fileId: PropTypes.string,
    ploopKey: PropTypes.string,
    recoId: PropTypes.string,
    recoURL: PropTypes.string.isRequired,
    recoCompleteURL: PropTypes.string,
    reco: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      reco: null,             // reco state copied from the server
      removingMovements: {},  // movementId: true
      undoHistory: [],        // List of reco states
      searchMovement: {},     // The content of the movement search fields
    };
  }

  componentDidUpdate(prevProps) {
    let recoState = this.state.reco;
    let initializing = false;

    if (this.props.open && !prevProps.open) {
      // Clear the old reco state.
      recoState = null;
      initializing = true;
    }

    if (!recoState && this.props.reco) {
      // Initialize the reco state.
      recoState = this.props.reco;
      initializing = true;
      this.updatePopoverPosition();
    }

    if (initializing) {
      this.setState({
        reco: recoState,
        removingMovements: {},
        undoHistory: [],
        searchMovement: {},
      });
    }
  }

  handleActionCallback(popoverActions) {
    this.setState({popoverActions});
  }

  updatePopoverPosition() {
    const {popoverActions} = this.state;
    if (popoverActions && popoverActions.updatePosition) {
      popoverActions.updatePosition();
    }
  }

  handleClose() {
    this.props.dispatch(closeRecoPopover());
  }

  handleClickTransfer(tid, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.dispatch(closeRecoPopover());
      this.props.history.push(`/t/${tid}`);
    }
  }

  handleRemoveMovement(movementId) {
    this.setState({removingMovements: {
      ...this.state.removingMovements,
      [movementId]: true,
    }});

    window.setTimeout(() => {
      const {
        reco,
      } = this.state;

      const movements = [];
      reco.movements.forEach(movement => {
        if (movement.id !== movementId) {
          movements.push(movement);
        }
      });

      this.setState({
        reco: {
          ...reco,
          movements
        },
        removingMovements: {
          ...this.state.removingMovements,
          [movementId]: undefined,
        },
        undoHistory: [
          ...this.state.undoHistory,
          reco,
        ],
      });

      this.updatePopoverPosition();
    }, 200);
  }

  handleAddMovement(movementId) {
  }

  handleUndo() {
    const {
      undoHistory,
    } = this.state;

    if (!undoHistory || !undoHistory.length) {
      return;
    }

    const len1 = undoHistory.length - 1;
    this.setState({
      reco: undoHistory[len1],
      undoHistory: undoHistory.slice(0, len1),
    });

    this.updatePopoverPosition();
  }

  getSearchMovementThrottler() {
    let t = this.searchMovementThrottler;
    if (!t) {
      t = throttler(this.throttledSearchMovement.bind(this), 400);
      this.searchMovementThrottler = t;
    }
    return t;
  }

  handleSearchMovement(fieldName, event) {
    const hadQuery = this.state.hasQuery;
    this.setState({searchMovement: {
      ...this.state.searchMovement,
      hasQuery: true,
      working: true,
      [fieldName]: event.target.value,
    }});
    this.getSearchMovementThrottler()();
    if (!hadQuery) {
      this.updatePopoverPosition();
    }
  }

  handleCloseSearchMovement() {
    this.setState({searchMovement: {}});
  }

  throttledSearchMovement() {
    const {searchMovement} = this.state;
    const hasQuery = !!(
      searchMovement.amount || searchMovement.date || searchMovement.transfer);
    if (hasQuery) {
      const {ploopKey, fileId, reco} = this.props;
      const seen_movement_ids = [];
      if (reco && reco.movements) {
        reco.movements.forEach(movement => {
          seen_movement_ids.push(movement.id);
        });
      }
      const url = fOPNReport.pathToURL('/reco-search-movement' +
        `?ploop_key=${encodeURIComponent(ploopKey)}` +
        `&file_id=${encodeURIComponent(fileId)}`);
      const data = {
        amount: searchMovement.amount || '',
        date: searchMovement.date || '',
        tzoffset: new Date().getTimezoneOffset(),
        transfer: searchMovement.transfer || '',
        seen_movement_ids,
      };
      const promise = this.props.dispatch(fOPNReport.fetch(url, {data}));
      promise.then(results => {
        const newSearch = this.state.searchMovement;
        if (newSearch.amount === searchMovement.amount &&
            newSearch.date === searchMovement.date &&
            newSearch.transfer === searchMovement.transfer) {
          this.setState({searchMovement: {
            ...this.state.searchMovement,
            results: results,
            working: false,
          }});
          this.updatePopoverPosition();
        }
        // else the query changed; expect another query to provide
        // the results.
      });
    } else {
      this.setState({searchMovement: {}});
    }
    this.updatePopoverPosition();
  }

  renderMovementRow(movement, addCandidate) {
    const {classes} = this.props;
    const {removingMovements} = this.state;

    const tid = dashed(movement.transfer_id);
    const mid = movement.id;
    const rowClass = `${classes.removableRow} ` + (
      removingMovements[mid] && !addCandidate ? classes.removingRow : '');

    let icon;
    if (addCandidate) {
      icon = (
        <AddCircle
          className={classes.addIcon}
          onClick={this.binder1(this.handleAddMovement, mid)} />);
    } else {
      icon = (
        <RemoveCircle
          className={classes.removeIcon}
          onClick={this.binder1(this.handleRemoveMovement, mid)} />);
    }

    return (
      <tr key={`mv-${mid}`} className={rowClass}>
        <td className={classes.actionCell}>
          {icon}
        </td>
        <td className={classes.numberCell}>
          {getCurrencyDeltaFormatter(movement.currency)(movement.delta)
          } {movement.currency}
        </td>
        <td className={classes.numberCell}>
          <FormattedDate value={movement.ts}
            day="numeric" month="short" year="numeric" />
          {' '}
          <FormattedTime value={movement.ts}
            hour="numeric" minute="2-digit" second="2-digit" />
        </td>
        <td className={classes.numberCell}>
          <a href={`/t/${tid}`}
              onClick={this.binder1(this.handleClickTransfer, tid)}>
            {tid} ({movement.number})
          </a>
        </td>
      </tr>
    );
  }

  renderMovementRows() {
    const {
      classes,
    } = this.props;

    const {
      reco,
      searchMovement,
    } = this.state;

    if (!reco) {
      return <CircularProgress />;
    }

    const rows = [
      (<tr key="mvHead1">
        <th colSpan="4" className={classes.headCell}>Movements</th>
      </tr>),
      (<tr key="mvHead2">
        <th width="10%" className={classes.head2Cell}></th>
        <th width="25%" className={classes.head2Cell}>
          {reco.is_circ ? 'Vault' : 'Wallet'}
        </th>
        <th width="25%" className={classes.head2Cell}>Date and Time</th>
        <th width="30%" className={classes.head2Cell}>Transfer (Movement #)</th>
      </tr>)];

    reco.movements.forEach(movement => {
      rows.push(this.renderMovementRow(movement, false));
    });

    if (searchMovement.hasQuery && searchMovement.results &&
        !searchMovement.working) {
      if (searchMovement.results.length) {
        searchMovement.results.forEach(movement => {
          rows.push(this.renderMovementRow(movement, true));
        });
      } else {
        rows.push(
        <tr key="mvSearchEmpty">
          <td></td>
          <td colSpan="3" className={classes.searchEmptyCell}>
            No movements found.
          </td>
        </tr>);
      }
    }

    if (searchMovement.working) {
      rows.push(
        <tr key="mvSearchWorking">
          <td></td>
          <td colSpan="3" className={classes.searchWorkingCell}>
            <CircularProgress
              size="24px"
              className={classes.searchWorkingIcon} />
          </td>
        </tr>);
    }

    rows.push(
      <tr key="mvSearchInput">
        <td className={classes.searchHeadCell}>
          {searchMovement.hasQuery ?
            <Close
              className={classes.searchCloseIcon}
              onClick={this.binder(this.handleCloseSearchMovement)} />
            : <Search className={classes.searchIcon} />}
        </td>
        <td className={classes.searchCell}>
          <Input
            classes={{input: classes.searchInput}}
            disableUnderline
            value={searchMovement.amount || ''}
            onChange={this.binder1(this.handleSearchMovement, 'amount')}
          />
        </td>
        <td className={classes.searchCell}>
          <Input
            classes={{input: classes.searchInput}}
            disableUnderline
            value={searchMovement.date || ''}
            onChange={this.binder1(this.handleSearchMovement, 'date')}
          />
        </td>
        <td className={classes.searchCell}>
          <Input
            classes={{input: classes.searchInput}}
            disableUnderline
            value={searchMovement.transfer || ''}
            onChange={this.binder1(this.handleSearchMovement, 'transfer')}
          />
        </td>
      </tr>
    );

    return rows;
  }

  renderTable() {
    const {
      classes,
    } = this.props;

    const {
      reco,
    } = this.state;

    if (!reco) {
      return <CircularProgress />;
    }

    const accountEntryRows = [];
    const movementRows = this.renderMovementRows();

    return (
      <table className={classes.table}>
        <tbody>
          <tr>
            <th colSpan="4"className={classes.headCell}>Account Entries</th>
          </tr>
          <tr>
            <th width="10%" className={classes.actionHeadCell}></th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date</th>
            <th width="30%" className={classes.head2Cell}>Description</th>
          </tr>
          {accountEntryRows}
          <tr>
            <td colSpan="4" className={classes.searchCell}></td>
          </tr>

          <tr>
            <td colSpan="4" className={classes.spaceRow}></td>
          </tr>

          {movementRows}

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
      recoCompleteURL,
    } = this.props;

    const {
      undoHistory,
    } = this.state;

    let require = null;
    if (recoURL) {
      const requireURLs = [recoURL];
      if (recoCompleteURL) {
        requireURLs.push(recoCompleteURL);
      }
      require = <Require urls={requireURLs} fetcher={fOPNReport} />;
    }

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
        action={this.binder(this.handleActionCallback)}
      >
        {require}
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
            {this.renderTable()}
          </Typography>
          <div className={classes.actionBox}>
            <div className={classes.actionLeftButtons}>
              <Button
                disabled={!undoHistory || !undoHistory.length}
                onClick={this.binder(this.handleUndo)}>Undo</Button>
            </div>
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
  const {ploop, file} = getPloopAndFile(state);
  const ploopKey = ploop.ploop_key;
  const fileId = file ? file.file_id : 'current';
  const {recoPopover} = state.report;
  const {recoId, movementId, accountEntryId} = recoPopover;
  let recoURL, reco;
  let recoCompleteURL = null;

  if (ploop) {
    const query = (
      `ploop_key=${encodeURIComponent(ploopKey)}` +
      `&file_id=${encodeURIComponent(fileId)}` +
      `&movement_id=${encodeURIComponent(movementId || '')}` +
      `&reco_id=${encodeURIComponent(recoId || '')}` +
      `&account_entry_id=${encodeURIComponent(accountEntryId || '')}`);
    recoURL = fOPNReport.pathToURL(`/reco?${query}`);
    reco = fetchcache.get(state, recoURL);

    if (reco) {
      // Now that the initial record is loaded, load the complete record,
      // which often takes longer because it updates all profiles and loops.
      recoCompleteURL = fOPNReport.pathToURL(`/reco-complete?${query}`);
      const recoComplete = fetchcache.get(state, recoCompleteURL);
      if (recoComplete) {
        reco = recoComplete;
      }
    }

  } else {
    recoURL = '';
    reco = null;
  }

  return {
    ...recoPopover,
    recoURL,
    recoCompleteURL,
    reco,
    ploopKey,
    fileId,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(RecoPopover);
