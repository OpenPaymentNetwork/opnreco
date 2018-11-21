
import { binder, binder1 } from '../../util/binder';
import { fOPNReport } from '../../util/fetcher';
import { throttler } from '../../util/throttler';
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
  removeCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  addCell: {
    backgroundColor: '#ffc',
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  addRemoveIcon: {
    color: '#333',
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
 * Render an editable list of movements or account entries in a RecoPopover.
 */
class RecoTableBody extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    fileId: PropTypes.string,
    ploopKey: PropTypes.string,
    items: PropTypes.array,
    updatePopoverPosition: PropTypes.func.isRequired,
    changeItems: PropTypes.func.isRequired,
    isCirc: PropTypes.bool,
    resetCount: PropTypes.number.isRequired,
    recoId: PropTypes.string,
    renderItemCells: PropTypes.func.isRequired,
    searchFields: PropTypes.array.isRequired,
    searchCallPath: PropTypes.string.isRequired,
    colCount: PropTypes.number.isRequired,
    tableTitle: PropTypes.string.isRequired,
    columnHeadRow: PropTypes.node.isRequired,
    emptyMessage: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      removing: {},         // itemId: true
      searchInputs: {},     // field: text
      searchResults: null,  // [item]
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
      searchInputs: {},
      searchResults: null,
      hasQuery: false,
      searching: false,
    });
  }

  handleRemove(itemId) {
    // Remove an item from the list.
    // Quickly animate the removal for clarity.
    this.setState({removing: {
      ...this.state.removing,
      [itemId]: true,
    }});

    window.setTimeout(() => {
      const {
        items,
      } = this.props;

      const newItems = [];
      items.forEach(item => {
        if (item.id !== itemId) {
          newItems.push(item);
        }
      });

      this.props.changeItems(newItems);
      this.setState({
        removing: {
          ...this.state.removing,
          [itemId]: undefined,
        },
      });
      this.props.updatePopoverPosition();
    }, 200);
  }

  handleAdd(itemId) {
    // Move an item from the search results to the reco's list of movements.
    const {items} = this.props;
    const {searchResults} = this.state;
    let item = null;

    const newSearchResults = [];
    if (searchResults) {
      searchResults.forEach(it => {
        if (it.id === itemId) {
          item = it;
        } else {
          newSearchResults.push(it);
        }
      });
    }

    const newItems = [];
    if (items) {
      items.forEach(it => {
        if (it.id !== itemId || item === null) {
          newItems.push(it);
        }
      });
    }
    if (item) {
      newItems.push(item);
    }

    this.props.changeItems(newItems);
    this.setState({searchResults: newSearchResults});

    if (!newSearchResults.length) {
      this.closeSearch();
    }

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

  handleSearchInput(fieldName, event) {
    const hadQuery = this.state.hasQuery;
    this.setState({
      hasQuery: true,
      searching: true,
      searchInputs: {
        ...this.state.searchInputs,
        [fieldName]: event.target.value,
      },
    });
    this.getSearchThrottler()();
    if (!hadQuery) {
      this.props.updatePopoverPosition();
    }
  }

  throttledSearch() {
    const {searchFields, searchCallPath} = this.props;
    const {searchInputs} = this.state;
    let hasQuery = false;
    searchFields.forEach(field => {
      if (searchInputs[field.name]) {
        hasQuery = true;
      }
    });
    if (hasQuery) {
      const {ploopKey, fileId, items, recoId} = this.props;
      const seen_ids = [];
      if (items) {
        items.forEach(item => {
          seen_ids.push(item.id);
        });
      }
      const url = fOPNReport.pathToURL(searchCallPath +
        `?ploop_key=${encodeURIComponent(ploopKey)}` +
        `&file_id=${encodeURIComponent(fileId)}`);
      const data = {
        tzoffset: new Date().getTimezoneOffset(),
        seen_ids,
        reco_id: recoId,
      };
      searchFields.forEach(field => {
        data[field.name] = searchInputs[field.name] || '';
      });
      const promise = this.props.dispatch(fOPNReport.fetch(url, {data}));
      promise.then(results => {
        const newSearchInputs = this.state.searchInputs;
        let match = true;
        searchFields.forEach(field => {
          if (newSearchInputs[field.name] !== searchInputs[field.name]) {
            match = false;
          }
        });
        if (match) {
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

  renderRow(item, addCandidate) {
    const {classes, renderItemCells} = this.props;
    const {removing} = this.state;

    const itemId = item.id;
    const rowClass = `${classes.removableRow} ` + (
      removing[itemId] && !addCandidate ? classes.removingRow : '');

    let icon;
    if (addCandidate) {
      icon = (
        <AddCircle
          className={classes.addRemoveIcon}
          onClick={this.binder1(this.handleAdd, itemId)} />);
    } else {
      icon = (
        <RemoveCircle
          className={classes.addRemoveIcon}
          onClick={this.binder1(this.handleRemove, itemId)} />);
    }

    return (
      <tr key={itemId} className={rowClass}>
        <td className={addCandidate ? classes.addCell : classes.removeCell}>
          {icon}
        </td>
        {renderItemCells(item, addCandidate)}
      </tr>
    );
  }

  render() {
    const {
      classes,
      items,
      colCount,
      tableTitle,
      columnHeadRow,
      searchFields,
    } = this.props;

    const {
      searchInputs,
      searchResults,
      hasQuery,
      searching,
    } = this.state;

    const rows = [
      (<tr key="head1">
        <th colSpan={colCount} className={classes.headCell}>
          {tableTitle}
        </th>
      </tr>)
    ];

    rows.push(columnHeadRow);

    if (items) {
      items.forEach(item => {
        rows.push(this.renderRow(item, false));
      });
    }

    if (hasQuery && searchResults) {
      if (searchResults.length) {
        searchResults.forEach(item => {
          rows.push(this.renderRow(item, true));
        });
      } else if (!searching) {
        rows.push(
        <tr key="searchEmpty">
          <td></td>
          <td colSpan={colCount - 1} className={classes.searchEmptyCell}>
            {this.props.emptyMessage}
          </td>
        </tr>);
      }
    }

    if (searching) {
      rows.push(
        <tr key="searching">
          <td></td>
          <td colSpan={colCount - 1} className={classes.searchingCell}>
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
        {searchFields.map(field => (
          <td key={field.name} className={classes.searchCell}
              colSpan={field.colSpan || 1}>
            <Input
              classes={{input: classes.searchInput}}
              disableUnderline
              value={searchInputs[field.name] || ''}
              onChange={this.binder1(this.handleSearchInput, field.name)}
            />
          </td>
        ))}
      </tr>
    );

    return <tbody>{rows}</tbody>;
  }
}


export default withStyles(styles)(RecoTableBody);
