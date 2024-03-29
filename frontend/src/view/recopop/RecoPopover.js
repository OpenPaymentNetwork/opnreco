
import { clearMost } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco } from '../../util/fetcher';
import { throttler } from '../../util/throttler';
import { withStyles } from '@material-ui/core/styles';
import AccountEntryTableBody from './AccountEntryTableBody';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Close from '@material-ui/icons/Close';
import Draggable from 'react-draggable';
import Fade from '@material-ui/core/Fade';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import MovementTableBody from './MovementTableBody';
import PeriodAssignSelect from '../period/PeriodAssignSelect';
import Popover from '@material-ui/core/Popover';
import PropTypes from 'prop-types';
import React from 'react';
import Redo from '@material-ui/icons/Redo';
import Require from '../../util/Require';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Undo from '@material-ui/icons/Undo';


const styles = theme => ({
  popoverContent: {
    width: '750px',
    minHeight: '250px',
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
    marginTop: '16px',
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
    height: '24px',
  },
  actionHeadCell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  metadataBox: {
    display: 'flex',
    marginBottom: '16px',
    justifyContent: 'space-between',
  },
  typeControl: {
    marginRight: '32px',
  },
  commentControl: {
    flexGrow: '1',
  },
});


let nextCreatingId = 1;


class RecoPopover extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    closeDialog: PropTypes.func.isRequired,
    open: PropTypes.bool,
    anchorEl: PropTypes.object,
    periodClosed: PropTypes.bool,
    fileArchived: PropTypes.bool,
    periods: PropTypes.array,
    recoId: PropTypes.string,
    recoURL: PropTypes.string.isRequired,
    recoFinalURL: PropTypes.string,
    reco: PropTypes.object,
    showVault: PropTypes.bool,
    windowPeriodId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      reco: null,             // reco state initially copied from the props
      undoLog: [],            // List of reco states
      redoLog: [],            // List of reco states
      popoverActions: null,
      resetCount: 0,
      typingComment: null,
      saving: false,
      dragged: false,
    };
  }

  componentDidUpdate(prevProps) {
    let reco = this.state.reco;
    let initializing = false;

    if (this.props.open && !prevProps.open) {
      // Clear the old reco state.
      reco = null;
      initializing = true;
    }

    if (!reco && this.props.reco) {
      // Initialize the reco state.
      reco = this.props.reco;
      initializing = true;
    }

    if (initializing) {
      this.setState({
        reco,
        undoLog: [],
        redoLog: [],
        typingComment: null,
        saving: false,
        dragged: false,
      });
      this.updatePopoverPosition();
    }
  }

  makeCreatingEntry() {
    const creatingId = nextCreatingId;
    nextCreatingId += 1;
    return {
      id: `creating_${creatingId}`,
      creating: true,
    };
  }

  handleActionCallback = (popoverActions) => {
    this.setState({ popoverActions });
  };

  updatePopoverPosition = () => {
    if (!this.state.dragged) {
      // Trigger popup reposition
      window.dispatchEvent(new Event('resize'));
    }
    // Here is the old way that doesn't work as of Material-UI v4
    // because the updatePosition() callback does nothing until
    // the popover sees a browser resize event:
    //
    // const {dragged, popoverActions} = this.state;
    // if (!dragged && popoverActions && popoverActions.updatePosition) {
    //   popoverActions.updatePosition();
    // }
  };

  /**
   * Commit all changes to state.reco and return the updated reco.
   * (Note: this does not push the changes to the server.)
   */
  commit() {
    const { typingComment, reco, undoLog } = this.state;
    let newReco = reco;
    let changed = false;

    if (typingComment !== null && typingComment !== undefined &&
      typingComment !== reco.comment) {
      // Commit the comment and record in the undo log.
      newReco = { ...reco, comment: typingComment };
      changed = true;
    }

    if (changed) {
      this.setState({
        reco: newReco,
        typingComment: null,
        undoLog: [...undoLog, reco],
        redoLog: [],
      });
      this.updatePopoverPosition();
    }

    return newReco;
  }

  handleUndo = () => {
    const {
      resetCount,
      undoLog,
      redoLog,
    } = this.state;

    if (!undoLog.length) {
      return;
    }

    const reco = this.commit();

    const newRedoLog = redoLog.slice();
    newRedoLog.push(reco);

    const newLength = undoLog.length - 1;
    this.setState({
      reco: undoLog[newLength],
      undoLog: undoLog.slice(0, newLength),
      redoLog: newRedoLog,
      // Search results can contain the same items as restored rows,
      // so close any active searches by incrementing resetCount.
      resetCount: resetCount + 1,
    });

    this.updatePopoverPosition();
  };

  handleRedo = () => {
    const {
      reco,
      resetCount,
      undoLog,
      redoLog,
    } = this.state;

    if (!redoLog.length) {
      return;
    }

    const newUndoLog = undoLog.slice();
    newUndoLog.push(reco);

    const newLength = redoLog.length - 1;
    this.setState({
      reco: redoLog[newLength],
      redoLog: redoLog.slice(0, newLength),
      undoLog: newUndoLog,
      // Search results can contain the same items as restored rows,
      // so close any active searches by incrementing resetCount.
      resetCount: resetCount + 1,
    });

    this.updatePopoverPosition();
  };

  /**
   * Change the reco and add to the undo list. Clear the redo list.
   */
  changeWithUndo(changes) {
    const { reco, undoLog } = this.state;
    this.setState({
      reco: { ...reco, ...changes },
      undoLog: [...undoLog, reco],
      redoLog: [],
    });
  }

  /**
   * Accept a change to the reco's movement list.
   */
  changeMovements = (movements) => {
    this.changeWithUndo({ movements });
  };

  /**
   * Accept a change to the reco's account_entries list.
   */
  changeAccountEntries = (account_entries) => {
    this.changeWithUndo({ account_entries });
  };

  /**
   * Accept a change to the reco_type.
   */
  handleRecoType = (event) => {
    this.changeWithUndo({ reco_type: event.target.value });
    this.updatePopoverPosition();
  };

  handleComment = (event) => {
    this.setState({
      typingComment: event.target.value,
      redoLog: [],
    });
    this.getCommitThrottler()();
  };

  handlePeriodChange = (event) => {
    this.changeWithUndo({ period_id: event.target.value });
    this.updatePopoverPosition();
  };

  getCommitThrottler() {
    let t = this.commitThrottler;
    if (!t) {
      t = throttler(this.commit.bind(this), 400);
      this.commitThrottler = t;
    }
    return t;
  }

  /**
   * Commit and save the changes.
   */
  handleSave = () => {
    const {
      windowPeriodId,
      recoId,
      dispatch,
    } = this.props;

    const reco = this.commit();

    const url = fOPNReco.pathToURL(
      `/period/${encodeURIComponent(windowPeriodId)}/reco-save`);
    const data = {
      reco,
      reco_id: recoId,
    };

    const promise = this.props.dispatch(fOPNReco.fetch(url, { data }));
    this.setState({ saving: true });
    promise.then(() => {
      this.setState({ saving: false });
      this.props.closeDialog();
      dispatch(clearMost());
    }).catch(() => {
      this.setState({ saving: false });
    });
  };

  onDragStart = () => {
    this.setState({ dragged: true });
  };

  renderTable() {
    const {
      dispatch,
      classes,
      windowPeriodId,
      recoURL,
      recoId,
      closeDialog,
      showVault,
      periodClosed,
      fileArchived,
    } = this.props;

    const {
      reco,
      resetCount,
    } = this.state;

    if (!recoURL) {
      // No reco specified and nothing is currently loading. Show nothing.
      return null;
    }

    if (!reco) {
      return <CircularProgress />;
    }

    const recoType = reco.reco_type;
    const colCount = showVault ? 5 : 4;

    const tableBodyProps = {
      closeDialog: closeDialog,
      dispatch: dispatch,
      windowPeriodId: windowPeriodId,
      recoId: recoId,
      resetCount: resetCount,
      showVault: showVault,
      updatePopoverPosition: this.updatePopoverPosition,
      disabled: periodClosed || fileArchived,
    };

    let accountEntryTableBody = null;
    if (recoType === 'standard' || recoType === 'account_only') {
      accountEntryTableBody = (
        <AccountEntryTableBody
          accountEntries={reco.account_entries}
          changeAccountEntries={this.changeAccountEntries}
          {...tableBodyProps}
        />
      );
    }

    let movementTableBody = null;
    if (recoType === 'standard' || recoType === 'wallet_only' ||
      recoType === 'vault_only') {
      movementTableBody = (
        <MovementTableBody
          movements={reco.movements}
          changeMovements={this.changeMovements}
          {...tableBodyProps}
        />
      );
    }

    return (
      <table className={classes.table}>
        {accountEntryTableBody}
        {accountEntryTableBody && movementTableBody ? (
          <tbody>
            <tr>
              <td colSpan={colCount} className={classes.spaceRow}></td>
            </tr>
          </tbody>
        ) : null}
        {movementTableBody}
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
      recoFinalURL,
      periodClosed,
      fileArchived,
      periods,
    } = this.props;

    const {
      reco,
      typingComment,
      undoLog,
      redoLog,
      saving,
    } = this.state;

    const disabled = periodClosed || fileArchived || !reco;

    let require = null;
    if (recoURL && open) {
      require = (
        <Require
          urls={[recoURL]}
          fetcher={fOPNReco}
          options={{
            finalURL: recoFinalURL,
          }} />);
    }

    let comment = '';
    if (typingComment !== null && typingComment !== undefined) {
      comment = typingComment;
    } else {
      comment = (reco ? reco.comment || '' : '');
    }

    const popoverContent = (
      <div className={classes.popoverContent}>
        {require}
        <Typography variant="h6" className={`titlebar ${classes.titleBar}`}>
          <span className={classes.popoverTitle}>Reconciliation {recoId}</span>
          <IconButton
            className={classes.closeButton}
            onClick={this.props.closeDialog}
          >
            <Close />
          </IconButton>
        </Typography>
        <Typography className={classes.content} component="div">

          <div className={classes.metadataBox}>
            <FormControl className={classes.typeControl} disabled={disabled}>
              <InputLabel shrink htmlFor="reco_reco_type">
                Type
              </InputLabel>
              <Select
                id="reco_reco_type"
                name="reco_type"
                value={reco ? reco.reco_type : 'standard'}
                displayEmpty
                onChange={this.handleRecoType}
              >
                <MenuItem value="standard">Standard Reconciliation</MenuItem>
                <MenuItem value="wallet_only">Wallet In/Out</MenuItem>
                <MenuItem value="account_only">Account Credit/Debit</MenuItem>
                <MenuItem value="vault_only">Vault Offset</MenuItem>
              </Select>
            </FormControl>
            <FormControl className={classes.periodControl} disabled={disabled}>
              <InputLabel shrink htmlFor="reco_period_id">
                Period
              </InputLabel>
              <PeriodAssignSelect
                id="reco_period_id"
                name="period_id"
                value={reco ? reco.period_id : ''}
                displayEmpty
                onChange={this.handlePeriodChange}
                periods={periods}
              />
            </FormControl>
          </div>

          <div className={classes.metadataBox}>
            <FormControl className={classes.commentControl}>
              <TextField
                name="comment"
                placeholder="Comment"
                value={comment}
                onChange={this.handleComment}
                multiline
                disabled={disabled}
              />
            </FormControl>
          </div>

          {this.renderTable()}
          <div className={classes.actionBox}>
            <div className={classes.actionLeftButtons}>
              <IconButton
                disabled={!undoLog.length || disabled}
                onClick={this.handleUndo}
              >
                <Undo />
              </IconButton>
              <IconButton
                disabled={!redoLog.length || disabled}
                onClick={this.handleRedo}
              >
                <Redo />
              </IconButton>
            </div>
            <Button
              color="primary"
              variant="contained"
              disabled={saving || disabled}
              onClick={this.handleSave}
            >
              Save
            </Button>
          </div>
        </Typography>
      </div>
    );

    return (
      <Popover
        id="reco-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={this.props.closeDialog}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        TransitionComponent={FadeDrag1}
        TransitionProps={{ onDragStart: this.onDragStart }}
        action={this.handleActionCallback}
        disableBackdropClick
        BackdropProps={{
          invisible: false,
        }}
      >
        {popoverContent}
      </Popover>
    );
  }
}

/**
 * Wrapper 1 for mixing Fade and Draggable
 */
class FadeDrag1 extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    onDragStart: PropTypes.func,
  };

  render() {
    const { children, onDragStart, ...rest } = this.props;
    return (
      <Fade {...rest}>
        <FadeDrag2 onDragStart={onDragStart}>
          {children}
        </FadeDrag2>
      </Fade>);
  }
}

/**
 * Wrapper 2 for mixing Fade and Draggable
 */
class FadeDrag2 extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    onDragStart: PropTypes.func,
  };

  render() {
    // Render Draggable with specific props.
    const { children, onDragStart, ...rest } = this.props;
    return (
      <Draggable
        handle=".titlebar"
        onStart={onDragStart}
      >
        {React.cloneElement(children, rest)}
      </Draggable>);
  }
}


function mapStateToProps(state, ownProps) {
  let recoURL, recoFinalURL, content;

  const encPeriodId = encodeURIComponent(ownProps.windowPeriodId);
  const query = (
    `movement_id=${encodeURIComponent(ownProps.movementId || '')}` +
    `&reco_id=${encodeURIComponent(ownProps.recoId || '')}` +
    `&account_entry_id=${encodeURIComponent(ownProps.accountEntryId || '')}`
  );
  recoURL = fOPNReco.pathToURL(
    `/period/${encPeriodId}/reco?${query}`);
  recoFinalURL = fOPNReco.pathToURL(
    `/period/${encPeriodId}/reco-final?${query}`);
  content = fetchcache.get(state, recoURL) || {};

  const {
    reco,
    loops,
    show_vault: showVault,
    period_closed: periodClosed,
    file_archived: fileArchived,
    periods,
  } = content;

  return {
    recoURL,
    recoFinalURL,
    reco,
    periods,
    loops,
    showVault,
    periodClosed,
    fileArchived,
  };
}


export default compose(
  withStyles(styles, { withTheme: true }),
  connect(mapStateToProps),
)(RecoPopover);
