
from decimal import Decimal
from opnreco.models.db import AccountEntry
from opnreco.models.db import FileMovement
from opnreco.models.db import Period
from opnreco.models.db import Reco
from opnreco.models.db import TransferRecord
from opnreco.viewcommon import get_tzname
from sqlalchemy import BigInteger
from sqlalchemy import Date
from sqlalchemy import cast
from sqlalchemy import func
from sqlalchemy import literal
from sqlalchemy import Numeric
from sqlalchemy import select
from sqlalchemy import String
from sqlalchemy import union_all
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.dialects.postgresql import array_agg
import collections
import datetime
import logging

log = logging.getLogger(__name__)

null = None
max_autoreco_delay = datetime.timedelta(days=7)
file_movement_delta = -(FileMovement.wallet_delta + FileMovement.vault_delta)


class SortableMatch:
    """A potential reconciliation match.

    Matches an account entry with an OPN movement. Scores the probability
    of a match. Provides a corresponding sort_key.
    """
    def __init__(self, row):
        # row is a candidate match.
        self.delta = row.delta
        self.account_entry_id = account_entry_id = row.account_entry_id
        self.entry_date = entry_date = row.entry_date
        self.description = description = row.description
        self.movement_ids = movement_ids = row.movement_ids
        self.movement_date = movement_date = row.movement_date
        self.transfer_id = transfer_id = row.transfer_id

        score = 0

        if transfer_id:
            clean_desc = description.replace('-', '')
            # Count how many characters of the transfer ID are found
            # in the description. Require at least 3 characters to improve
            # the score.
            maxlen = min(len(transfer_id), len(clean_desc))
            for length in range(maxlen, 2, -1):
                if transfer_id[:length] in clean_desc:
                    # This scoring function seems reasonable for
                    # matching 11 digit transfer IDs.
                    score += 1.5 ** length
                    break

        # The closer in time, the higher the score.
        score -= abs((entry_date - movement_date).days)

        self.score = score

        self.sort_key = (
            score, entry_date, account_entry_id, tuple(sorted(movement_ids)))


def build_single_movement_query(dbsession, owner, period):
    """Build a query that lists the unreconciled movements in open periods.

    Return a query providing these columns:

    - transfer_id
    - date
    - delta
    - movement_ids
    """
    movement_date_c = func.date(func.timezone(
        get_tzname(owner),
        func.timezone('UTC', FileMovement.ts)
    ))

    return (
        dbsession.query(
            TransferRecord.transfer_id,
            movement_date_c.label('date'),
            file_movement_delta.label('delta'),
            array([FileMovement.movement_id]).label('movement_ids'),
        )
        .select_from(FileMovement)
        .join(
            TransferRecord,
            TransferRecord.id == FileMovement.transfer_record_id)
        .join(Period, Period.id == FileMovement.period_id)
        .filter(
            FileMovement.owner_id == owner.id,
            FileMovement.file_id == period.file_id,
            FileMovement.reco_id == null,
            file_movement_delta != 0,
            ~Period.closed,
        ))


class BundleFinder:
    """Build a query that lists the qualified, unreconciled bundled transfers.

    (Note: In this class, there is a strict distinction between "bundle"
    and "bundled". A bundle transfer contains bundled transfers.)

    Find both the unreconciled bundle transfers and the related unreconciled
    bundled transfers. Ensure they match, then provide a list of bundles
    as a query with standard columns.

    find() returns None if there are no qualified unreconciled bundle
    transfers. Otherwise, it returns a query providing these columns:

    - transfer_id
    - date
    - currency
    - loop_id
    - delta
    - movement_ids
    """

    def __init__(self, dbsession, owner, period):
        self.dbsession = dbsession
        self.owner = owner
        self.period = period

    def find(self):
        """Create and return bundle_query or None (if nothing qualifies)."""
        movement_list_lookup = self.build_movement_list_lookup()
        if not movement_list_lookup:
            return None

        bundle_records = self.list_bundle_records()
        if not bundle_records:
            return None

        qualified_bundles = self.list_qualified_bundles(
            bundle_records=bundle_records,
            movement_list_lookup=movement_list_lookup)
        if not qualified_bundles:
            return None

        return self.build_query(qualified_bundles=qualified_bundles)

    def build_movement_list_lookup(self):
        """List the unreconciled movements that could be part of bundles."""
        dbsession = self.dbsession
        owner = self.owner
        period = self.period

        movement_rows = (
            dbsession.query(
                FileMovement.issuer_id,
                TransferRecord.transfer_id,
                func.sum(file_movement_delta).label('delta'),
                array_agg(FileMovement.movement_id).label('movement_ids'),
            )
            .select_from(FileMovement)
            .join(
                TransferRecord,
                TransferRecord.id == FileMovement.transfer_record_id)
            .join(Period, Period.id == FileMovement.period_id)
            .filter(
                FileMovement.owner_id == owner.id,
                FileMovement.file_id == period.file_id,
                FileMovement.reco_id == null,
                file_movement_delta != 0,
                TransferRecord.bundle_transfer_id != null,
                ~Period.closed,
            )
            .group_by(
                FileMovement.issuer_id,
                TransferRecord.transfer_id,
            )
            .all())

        log.info(
            "BundleFinder: %s unreconciled bundled movement(s) for period %s",
            len(movement_rows), period.id)

        # movement_list_lookup: {
        #     (bundled_transfer_id, issuer_id): (delta, movement_ids)
        # }
        movement_list_lookup = {}
        for row in movement_rows:
            key = (row.transfer_id, row.issuer_id)
            movement_list_lookup[key] = (row.delta, row.movement_ids)

        return movement_list_lookup

    def list_bundle_records(self):
        """List bundle transfers that contain unreconciled bundled movements.
        """
        dbsession = self.dbsession
        owner = self.owner
        period = self.period

        # bundle_transfer_ids_cte lists the bundle transfer IDs
        # of the unreconciled bundled movements for this file.
        bundle_transfer_ids_cte = (
            dbsession.query(TransferRecord.bundle_transfer_id)
            .select_from(FileMovement)
            .join(
                TransferRecord,
                TransferRecord.id == FileMovement.transfer_record_id)
            .join(Period, Period.id == FileMovement.period_id)
            .filter(
                FileMovement.owner_id == owner.id,
                FileMovement.file_id == period.file_id,
                FileMovement.reco_id == null,
                file_movement_delta != 0,
                TransferRecord.bundle_transfer_id != null,
                ~Period.closed,
            )
            .distinct()
            .cte('bundle_transfer_ids_cte'))

        record_date_c = func.date(func.timezone(
            get_tzname(owner),
            func.timezone('UTC', TransferRecord.start)
        ))

        bundle_records = (
            dbsession.query(
                TransferRecord.transfer_id,
                TransferRecord.bundled_transfers,
                record_date_c.label('date'),
            )
            .filter(
                TransferRecord.owner_id == owner.id,
                TransferRecord.transfer_id.in_(bundle_transfer_ids_cte),
                TransferRecord.bundled_transfers != null,
                func.jsonb_array_length(TransferRecord.bundled_transfers) > 0,
            )
            .order_by(TransferRecord.start, TransferRecord.transfer_id)
            .all())

        log.info(
            "BundleFinder: %s unreconciled bundle(s) for period %s",
            len(bundle_records), period.id)

        return bundle_records

    def list_qualified_bundles(self, bundle_records, movement_list_lookup):
        """List the bundle records qualified for auto reconciliation.

        The results must be formatted for building the bundle_query.

        Note that this may generate more than one bundle per transfer,
        especially if the bundle transfer used multiple issuers.

        Return [(
            bundle_transfer_id,
            date,
            delta,
            movement_ids,
        )].
        """
        qualified_bundles = []

        for bundle_record in bundle_records:
            # specs is the mapping of movements required for each bundle
            # to qualify for automatic bundle reconciliation.
            # specs:
            # {issuer_id: {bundled_transfer_id: delta}}
            specs = collections.defaultdict(
                lambda: collections.defaultdict(Decimal))
            for t in bundle_record.bundled_transfers:
                key = t['issuer_id']
                specs[key][t['transfer_id']] += Decimal(t['amount'])

            for issuer_id, spec in sorted(specs.items()):
                # issuer_id and spec describe a potentially reconcilable
                # bundle. Do the unreconciled movements match the spec?
                qualified = True
                bundled_movement_ids = []
                total_delta = Decimal()
                for bundled_transfer_id, spec_delta in sorted(spec.items()):
                    movement_key = (bundled_transfer_id, issuer_id)
                    movements_info = movement_list_lookup.get(movement_key)
                    if not movements_info:
                        # The bundle should not be reconciled
                        # automatically because this bundled transfer
                        # was not downloaded or is already
                        # reconciled (in full or in part).
                        qualified = False
                        break
                    else:
                        movements_delta, movement_ids = movements_info
                        if movements_delta != spec_delta:
                            # The bundle transfer should not be reconciled
                            # automatically because this bundled transfer
                            # did not send the specified amount or is already
                            # reconciled (in full or in part).
                            qualified = False
                            break
                        else:
                            bundled_movement_ids.extend(movement_ids)
                            total_delta += spec_delta

                if not qualified:
                    continue

                # Found a qualified bundle. Add it to qualified_bundles.
                qualified_bundles.append((
                    bundle_record.transfer_id,
                    bundle_record.date,
                    total_delta,
                    bundled_movement_ids,
                ))

        log.info(
            "BundleFinder: %s qualified bundle(s) for period %s",
            len(qualified_bundles), self.period.id)
        return qualified_bundles

    def build_query(self, qualified_bundles):
        """Create a query from the qualified bundles."""
        stmts = []
        for tup in qualified_bundles:
            (
                transfer_id,
                date,
                delta,
                movement_ids,
            ) = tup
            if not stmts:
                # Apply column types and labels to the first row.
                stmts.append(select([
                    cast(literal(transfer_id), String).label('transfer_id'),
                    cast(literal(date), Date).label('date'),
                    cast(literal(delta), Numeric).label('delta'),
                    array(movement_ids, type_=BigInteger).label(
                        'movement_ids'),
                ]))
            else:
                # The column types and labels in the remaining rows are
                # inferred from the first row.
                stmts.append(select([
                    literal(transfer_id),
                    literal(date),
                    literal(delta),
                    array(movement_ids),
                ]))

        query = union_all(*stmts)
        return query


def auto_reco_statement(dbsession, owner, period, statement):
    """Add external reconciliations automatically for a statement."""

    # Reconcile with individual movements
    single_movement_query = build_single_movement_query(
        dbsession=dbsession,
        owner=owner,
        period=period)

    # Also reconcile with bundled movements (receive_ach_file transfers,
    # for example.)
    bundle_query = BundleFinder(
        dbsession=dbsession,
        owner=owner,
        period=period).find()

    if bundle_query is not None:
        # Include bundle matches.
        movement_query = union_all(bundle_query, single_movement_query)
    else:
        movement_query = single_movement_query

    movement_cte = movement_query.cte('movement_cte')

    # Build all_matches, a list of all possible reconciliations
    # of this statement with existing OPN movements.
    # This query is an intentional but filtered cartesian join between
    # movement_cte and the account_entry table.

    all_matches = (
        dbsession.query(
            AccountEntry.delta,
            AccountEntry.id.label('account_entry_id'),
            AccountEntry.entry_date,
            AccountEntry.description,
            movement_cte.c.movement_ids,
            movement_cte.c.date.label('movement_date'),
            movement_cte.c.transfer_id,
        )
        .join(movement_cte, movement_cte.c.delta == AccountEntry.delta)
        .join(Period, Period.id == AccountEntry.period_id)
        .filter(
            AccountEntry.owner_id == owner.id,
            AccountEntry.file_id == period.file_id,
            AccountEntry.statement_id == statement.id,
            AccountEntry.reco_id == null,
            AccountEntry.delta != 0,
            ~Period.closed,
        )
        .all())

    # Group the matches by amount delta in the 'by_delta' map.
    # by_delta: {delta: [SortableMatch]}
    by_delta = collections.defaultdict(list)

    for match in all_matches:
        if match.entry_date < match.movement_date:
            # The account entry happened before the movement, so
            # disqualify this match for autoreco.
            continue

        if match.entry_date > match.movement_date + max_autoreco_delay:
            # The account entry happened a long time after the
            # movement, so disqualify this match for autoreco.
            continue

        by_delta[match.delta].append(SortableMatch(match))

    # For each group of possible matches in by_delta, apply the best
    # matches first. As matches are chosen, later matches are disqualified
    # automatically because the movement_id has been added to the
    # movement_recos dict or the account_entry_id has been added to
    # the entry_recos dict.

    # Note: to minimize the number of database interactions, we create
    # all the recos at once and update the movements and account entries
    # afterward. This unfortunately leads to the need for the reco_index
    # concept (which is an index in the new_recos list) as opposed to
    # reco_id, since the reco_id is chosen later.
    # Fortunately, the reco_index does not live beyond this function.

    def sort_match(sortable_match):
        return sortable_match.sort_key

    new_reco_count = 0   # The number of Recos to create
    entry_recos = {}     # account_entry_id: reco_index
    movement_recos = {}  # movement_id: reco_index

    for match_list in by_delta.values():
        match_list.sort(key=sort_match, reverse=True)
        for match in match_list:
            qualified = True
            for movement_id in match.movement_ids:
                if movement_id in movement_recos:
                    # Already matched.
                    qualified = False
                    break
            if not qualified:
                continue
            if match.account_entry_id in entry_recos:
                # Already matched.
                continue
            reco_index = new_reco_count
            new_reco_count = reco_index + 1
            for movement_id in match.movement_ids:
                movement_recos[movement_id] = reco_index
            entry_recos[match.account_entry_id] = reco_index

    if not new_reco_count:
        return

    # Create a reco for each of the new matches.
    new_recos = []
    for i in range(new_reco_count):
        reco = Reco(
            owner_id=owner.id,
            period_id=period.id,
            reco_type='standard',
            internal=False,
        )
        dbsession.add(reco)
        new_recos.append(reco)

    # Assign the reco IDs.
    dbsession.flush()

    # Get the movements and assign their reco_ids and period_ids.
    file_movements = (
        dbsession.query(FileMovement)
        .filter(
            FileMovement.file_id == period.file_id,
            FileMovement.movement_id.in_(movement_recos.keys()))
        .all())
    for fm in file_movements:
        reco = new_recos[movement_recos[fm.movement_id]]
        fm.reco_id = reco.id
        fm.period_id = period.id
    dbsession.flush()

    # Get the account entries and assign their reco_ids.
    entries = (
        dbsession.query(AccountEntry)
        .filter(AccountEntry.id.in_(entry_recos.keys()))
        .all())
    for entry in entries:
        reco = new_recos[entry_recos[entry.id]]
        entry.reco_id = reco.id
        entry.period_id = period.id
    dbsession.flush()
