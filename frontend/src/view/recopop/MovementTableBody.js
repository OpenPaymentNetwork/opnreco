
import { binder, binder1 } from '../../util/binder';
import { closeRecoPopover } from '../../reducer/report';
import { compose } from '../../util/functional';
import { dashed } from '../../util/transferfmt';
import { fOPNReport } from '../../util/fetcher';
import { FormattedDate, FormattedTime } from 'react-intl';
import { getCurrencyDeltaFormatter } from '../../util/currency';
import { throttler } from '../../util/throttler';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import AddCircle from '@material-ui/icons/AddCircle';
import RemoveCircle from '@material-ui/icons/RemoveCircle';
import CircularProgress from '@material-ui/core/CircularProgress';
import Close from '@material-ui/icons/Close';
import Input from '@material-ui/core/Input';
import PropTypes from 'prop-types';
import React from 'react';
import Search from '@material-ui/icons/Search';


const styles = {
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
  actionCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  addRemoveIcon: {
    cursor: 'pointer',
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
  searchingCell: {
    border: '1px solid #bbb',
  },
  searchingIcon: {
    display: 'block',
    margin: '2px auto',
  },
  searchEmptyCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
    padding: '4px 8px',
    fontStyle: 'italic',
  },
};

/**
 * Render the tbody in a RecoPopover that shows wallet/vault movements.
 */
class MovementTableBody extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    fileId: PropTypes.string,
    ploopKey: PropTypes.string,
    movements: PropTypes.array,
    updatePopoverPosition: PropTypes.func.isRequired,
    changeMovements: PropTypes.func.isRequired,
    isCirc: PropTypes.bool,
    resetCount: PropTypes.number.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      removing: {},         // movementId: true
      searchFields: {},     // field: text
      searchResults: null,  // [movement]
      hasQuery: false,
      searching: false,
    };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetCount !== this.props.resetCount) {
      this.closeSearch();
    }
  }

  closeSearch() {
    this.setState({
      searchFields: {},
      searchResults: null,
      hasQuery: false,
      searching: false,
    });
  }

  handleClickTransfer(tid, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.dispatch(closeRecoPopover());
      this.props.history.push(`/t/${tid}`);
    }
  }

  handleRemove(movementId) {
    // Remove an item from the list of movements.
    // Quickly animate the removal for clarity.
    this.setState({removing: {
      ...this.state.removing,
      [movementId]: true,
    }});

    window.setTimeout(() => {
      const {
        movements,
      } = this.props;

      const newMovements = [];
      movements.forEach(movement => {
        if (movement.id !== movementId) {
          newMovements.push(movement);
        }
      });

      this.props.changeMovements(newMovements);
      this.setState({
        removing: {
          ...this.state.removing,
          [movementId]: undefined,
        },
      });
      this.props.updatePopoverPosition();
    }, 200);
  }

  handleAdd(movementId) {
    // Move an item from the search results to the reco's list of movements.
    const {movements} = this.props;
    const {searchResults} = this.state;
    let movement = null;

    const newSearchResults = [];
    if (searchResults) {
      searchResults.forEach(m => {
        if (m.id === movementId) {
          movement = m;
        } else {
          newSearchResults.push(m);
        }
      });
    }

    const newMovements = [];
    if (movements) {
      movements.forEach(m => {
        if (m.id !== movementId || movement === null) {
          newMovements.push(m);
        }
      });
    }
    if (movement) {
      newMovements.push(movement);
    }

    this.props.changeMovements(newMovements);
    this.setState({searchResults: newSearchResults});
    this.props.updatePopoverPosition();
  }

  getSearchThrottler() {
    let t = this.searchThrottler;
    if (!t) {
      t = throttler(this.throttledSearch.bind(this), 400);
      this.searchThrottler = t;
    }
    return t;
  }

  handleSearchField(fieldName, event) {
    const hadQuery = this.state.hasQuery;
    this.setState({
      hasQuery: true,
      searching: true,
      searchFields: {
        ...this.state.searchFields,
        [fieldName]: event.target.value,
      },
    });
    this.getSearchThrottler()();
    if (!hadQuery) {
      this.props.updatePopoverPosition();
    }
  }

  throttledSearch() {
    const {searchFields} = this.state;
    const hasQuery = !!(
      searchFields.amount || searchFields.date || searchFields.transfer);
    if (hasQuery) {
      const {ploopKey, fileId, movements} = this.props;
      const seen_movement_ids = [];
      if (movements) {
        movements.forEach(movement => {
          seen_movement_ids.push(movement.id);
        });
      }
      const url = fOPNReport.pathToURL('/reco-search-movement' +
        `?ploop_key=${encodeURIComponent(ploopKey)}` +
        `&file_id=${encodeURIComponent(fileId)}`);
      const data = {
        amount: searchFields.amount || '',
        date: searchFields.date || '',
        tzoffset: new Date().getTimezoneOffset(),
        transfer: searchFields.transfer || '',
        seen_movement_ids,
      };
      const promise = this.props.dispatch(fOPNReport.fetch(url, {data}));
      promise.then(results => {
        const newSearchFields = this.state.searchFields;
        if (newSearchFields.amount === searchFields.amount &&
            newSearchFields.date === searchFields.date &&
            newSearchFields.transfer === searchFields.transfer) {
          this.setState({
            searchResults: results,
            searching: false,
          });
          this.props.updatePopoverPosition();
        }
        // else the query changed; expect another query to provide
        // the results.
      });
    } else {
      this.closeSearch();
    }
    this.props.updatePopoverPosition();
  }

  renderRow(movement, addCandidate) {
    const {classes} = this.props;
    const {removing} = this.state;

    const tid = dashed(movement.transfer_id);
    const mid = movement.id;
    const rowClass = `${classes.removableRow} ` + (
      removing[mid] && !addCandidate ? classes.removingRow : '');

    let icon;
    if (addCandidate) {
      icon = (
        <AddCircle
          className={classes.addRemoveIcon}
          onClick={this.binder1(this.handleAdd, mid)} />);
    } else {
      icon = (
        <RemoveCircle
          className={classes.addRemoveIcon}
          onClick={this.binder1(this.handleRemove, mid)} />);
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

  render() {
    const {
      classes,
      movements,
      isCirc,
    } = this.props;

    const {
      searchFields,
      searchResults,
      hasQuery,
      searching,
    } = this.state;

    const rows = [
      (<tr key="head1">
        <th colSpan="4" className={classes.headCell}>Movements</th>
      </tr>),
      (<tr key="head2">
        <th width="10%" className={classes.head2Cell}></th>
        <th width="25%" className={classes.head2Cell}>
          {isCirc ? 'Vault' : 'Wallet'}
        </th>
        <th width="25%" className={classes.head2Cell}>Date and Time</th>
        <th width="30%" className={classes.head2Cell}>Transfer (Movement #)</th>
      </tr>)];

    if (movements) {
      movements.forEach(movement => {
        rows.push(this.renderRow(movement, false));
      });
    }

    if (hasQuery && searchResults) {
      if (searchResults.length) {
        searchResults.forEach(movement => {
          rows.push(this.renderRow(movement, true));
        });
      } else if (!searching) {
        rows.push(
        <tr key="searchEmpty">
          <td></td>
          <td colSpan="3" className={classes.searchEmptyCell}>
            No movements found.
          </td>
        </tr>);
      }
    }

    if (searching) {
      rows.push(
        <tr key="searching">
          <td></td>
          <td colSpan="3" className={classes.searchingCell}>
            <CircularProgress
              size="24px"
              className={classes.searchingIcon} />
          </td>
        </tr>);
    }

    rows.push(
      <tr key="searchInput">
        <td className={classes.searchHeadCell}>
          {hasQuery ?
            <Close
              className={classes.searchCloseIcon}
              onClick={this.binder(this.closeSearch)} />
            : <Search className={classes.searchIcon} />}
        </td>
        <td className={classes.searchCell}>
          <Input
            classes={{input: classes.searchInput}}
            disableUnderline
            value={searchFields.amount || ''}
            onChange={this.binder1(this.handleSearchField, 'amount')}
          />
        </td>
        <td className={classes.searchCell}>
          <Input
            classes={{input: classes.searchInput}}
            disableUnderline
            value={searchFields.date || ''}
            onChange={this.binder1(this.handleSearchField, 'date')}
          />
        </td>
        <td className={classes.searchCell}>
          <Input
            classes={{input: classes.searchInput}}
            disableUnderline
            value={searchFields.transfer || ''}
            onChange={this.binder1(this.handleSearchField, 'transfer')}
          />
        </td>
      </tr>
    );

    return <tbody>{rows}</tbody>;
  }
}


export default compose(
  withStyles(styles),
  withRouter,
)(MovementTableBody);
