
import { binder, binder1 } from '../../util/binder';
import { FormattedDate } from 'react-intl';
import { getCurrencyDeltaFormatter } from '../../util/currency';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import RecoTableBody from './RecoTableBody';


const styles = {
  head2Cell: {
    backgroundColor: '#eee',
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  cell: {
    border: '1px solid #bbb',
    padding: '2px 8px',
  },
  numberCell: {
    textAlign: 'right',
  },
  candidateCell: {
    backgroundColor: '#ffc',
  },
};


/**
 * Render the tbody in a RecoPopover that shows account entries.
 */
class AccountEntryTableBody extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    accountEntries: PropTypes.array,
    changeAccountEntries: PropTypes.func.isRequired,
    showVault: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
  }

  renderItemCells(entry, addCandidate) {
    const {classes, showVault} = this.props;
    const numCell = `${classes.cell} ${classes.numberCell}` + (
      addCandidate ? ` ${classes.candidateCell}` : '');
    const txtCell = `${classes.cell}` + (
      addCandidate ? ` ${classes.candidateCell}` : '');

    return (
      <React.Fragment>
        <td className={numCell} colSpan={showVault ? 2 : 1}>
          {getCurrencyDeltaFormatter(entry.currency)(entry.delta)
          } {entry.currency}
        </td>
        <td className={numCell}>
          <FormattedDate value={entry.entry_date}
            day="numeric" month="short" year="numeric"
            timeZone="UTC" title={entry.entry_date} />
        </td>
        <td className={txtCell}>
          {entry.description}
        </td>
      </React.Fragment>
    );
  }

  render() {
    const {
      classes,
      accountEntries,
      changeAccountEntries,
      showVault,
      ...otherProps
    } = this.props;

    let columnHeadRow;

    if (showVault) {
      columnHeadRow = (
        <tr key="head2">
          <th width="10%" className={classes.head2Cell}></th>
          <th colSpan="2" className={classes.head2Cell}>Amount</th>
          <th width="25%" className={classes.head2Cell}>Date</th>
          <th width="35%" className={classes.head2Cell}>Description</th>
        </tr>);
    } else {
      columnHeadRow = (
        <tr key="head2">
          <th width="10%" className={classes.head2Cell}></th>
          <th width="15%" className={classes.head2Cell}>Amount</th>
          <th width="25%" className={classes.head2Cell}>Date</th>
          <th width="50%" className={classes.head2Cell}>Description</th>
        </tr>);
    }

    return (
      <RecoTableBody
        items={accountEntries}
        changeItems={changeAccountEntries}
        showVault={showVault}
        renderItemCells={this.binder(this.renderItemCells)}
        searchFields={[
          {name: 'delta', colSpan: showVault ? 2 : 1},
          {name: 'entry_date'},
          {name: 'description'},
        ]}
        searchView="reco-search-account-entries"
        tableTitle="Account Entries"
        columnHeadRow={columnHeadRow}
        emptyMessage="No eligible account entries found."
        {...otherProps}
      />);
  }
}

export default withStyles(styles)(AccountEntryTableBody);
