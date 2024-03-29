# from opnreco.models import perms
# from opnreco.models.db import Period
# from opnreco.models.db import Peer
# from opnreco.models.site import API
# from opnreco.viewcommon import get_loop_map
# from pyramid.view import view_config
# from sqlalchemy import and_
# from sqlalchemy import func
# from sqlalchemy import or_
# from sqlalchemy.orm import aliased


# def make_ploop_cte(dbsession, owner, with_non_circ=True):
#     """Generate a CTE that lists the owner's available ploops."""

#     # The owner can reconcile any 'c' peer loop that has
#     # seen movements to/from a vault, indicating the owner is
#     # an issuer (of cash in the period's currency and loop).
#     conditions = [and_(Period.peer_id == 'c', Period.has_vault)]
#     if with_non_circ:
#         # The owner can reconcile any peer loop associated with their
#         # own DFI account.
#         conditions.append(Peer.is_own_dfi_account)

#     return (
#         dbsession.query(Period.peer_id, Period.loop_id, Period.currency)
#         .join(Peer, and_(
#             Peer.owner_id == owner.id,
#             Peer.peer_id == Period.peer_id))
#         .filter(
#             Period.owner_id == owner.id,
#             or_(*conditions)
#         )
#         .distinct()
#         .cte('ploop_cte'))


# @view_config(
#     name='ploops',
#     context=API,
#     permission=perms.use_app,
#     renderer='json')
# def ploops_api(request):
#     """Return the owner profile's list of peer loops ('ploops') and periods.

#     Normally limits the results to 10 periods per peer loop.

#     Return {
#         'ploops': {ploop_key: {
#             'ploop_key',
#             'peer_id',
#             'loop_id',
#             'currency',
#             'peer_title',
#             'peer_username',
#             'peer_is_dfi_account',
#             'peer_is_own_dfi_account',
#             'loop_title',
#             'periods': {period_id: {
#                 'id',
#                 'start_date',
#                 'end_date',
#                 'closed',
#             }},
#             'period_order': [period_id],
#         }},
#         'ploop_order': [ploop_key],
#         'default_ploop': ploop_key,
#         'ploop_keys': {period_id: ploop_key},
#     }
#     """
#     owner = request.owner
#     owner_id = owner.id
#     dbsession = request.dbsession
#     selected_period_id = request.params.get('period_id')

#     # ploop_cte prepares the list of peer loops the owner profile should see.
#     ploop_cte = make_ploop_cte(dbsession=dbsession, owner=owner)

#     if not owner.show_non_circ_with_circ:
#         has_circ = (
#             dbsession.query(ploop_cte.c.peer_id)
#             .filter(ploop_cte.c.peer_id == 'c')
#             .first())
#         if has_circ:
#             # Limit to circulation peers.
#             ploop_cte = make_ploop_cte(
#                 dbsession=dbsession, owner=owner, with_non_circ=False)

#     # ploop_rows is the list of visible peer loops,
#     # with a loop title if available.
#     ploop_rows = (
#         dbsession.query(
#             Peer,
#             ploop_cte.c.loop_id,
#             ploop_cte.c.currency)
#         .join(ploop_cte, ploop_cte.c.peer_id == Peer.peer_id)
#         .filter(
#             Peer.owner_id == owner_id,
#         )
#         .all())

#     # Now list some of the periods in each visible peer loop.
#     # Get up to 10 periods per peer loop, plus the selected period, if any.
#     # (To access more of the periods, the user should select the period
#     # using the Periods tab.)
#     subq = (
#         dbsession.query(
#             Period,
#             func.row_number().over(
#                 partition_by=(
#                     Period.peer_id,
#                     Period.loop_id,
#                     Period.currency,
#                 ),
#                 order_by=Period.start_date.desc(),
#             ).label('rownum'),
#         )
#         .join(ploop_cte, and_(
#             Period.peer_id == ploop_cte.c.peer_id,
#             Period.loop_id == ploop_cte.c.loop_id,
#             Period.currency == ploop_cte.c.currency,
#         ))
#         .filter(Period.owner_id == owner_id)
#         .subquery('subq'))

#     period_alias = aliased(Period, subq)
#     period_filters = [subq.c.rownum <= 10]
#     if selected_period_id:
#         period_filters.append(subq.c.id == selected_period_id)
#     period_rows = (
#         dbsession.query(period_alias)
#         .filter(or_(*period_filters))
#         .all())

#     # ploops: {peer_id-loop_id-currency: {periods, period_order, ...}}
#     ploops = {}

#     need_loop_ids = set()
#     for peer, loop_id, currency in ploop_rows:
#         need_loop_ids.add(loop_id)

#     loop_map = get_loop_map(
#         request=request,
#         need_loop_ids=need_loop_ids,
#         final=bool(selected_period_id))

#     for peer, loop_id, currency in ploop_rows:
#         ploop_key = '-'.join([peer.peer_id, loop_id, currency])
#         if loop_id == '0':
#             loop_title = ''
#         else:
#             loop_title = loop_map[loop_id]['title']
#         ploops[ploop_key] = {
#             'ploop_key': ploop_key,
#             'peer_id': peer.peer_id,
#             'loop_id': loop_id,
#             'currency': currency,
#             'peer_title': peer.title,
#             'peer_username': peer.username,
#             'peer_is_dfi_account': peer.is_dfi_account,
#             'peer_is_own_dfi_account': peer.is_own_dfi_account,
#             'loop_title': loop_title,
#             'periods': {},
#             'period_order': [],
#         }

#     ploop_keys = {}  # {period_id: ploop_key}

#     for period in period_rows:
#         ploop_key = '-'.join([period.peer_id, period.loop_id, period.currency])
#         ploop = ploops[ploop_key]
#         period_id_str = str(period.id)
#         ploop['periods'][period_id_str] = {
#             'id': period_id_str,
#             'start_date': period.start_date,
#             'end_date': period.end_date,
#             'closed': period.closed,
#         }
#         ploop['period_order'].append(period_id_str)
#         ploop_keys[period_id_str] = ploop_key

#     # Determine the ordering of the ploops.

#     ploop_ordering = []
#     default_ordering = []

#     for ploop_key, ploop in ploops.items():
#         peer_title = ploop['peer_title']
#         peer_id = ploop['peer_id']
#         loop_title = ploop['loop_title']
#         loop_id = ploop['loop_id']
#         currency = ploop['currency']

#         sort_key = (
#             0 if peer_id == 'c' else 1,
#             0 if ploop['peer_is_own_dfi_account'] else 1,
#             peer_title.lower(),
#             peer_title,
#             peer_id,
#             '' if currency == 'USD' else currency,
#             loop_title.lower(),
#             loop_title,
#             loop_id,
#         )
#         ploop_ordering.append((sort_key, ploop_key))

#         # Prefer to show circulation ploops over other types of ploops.
#         default_key = (
#             0 if peer_id == 'c' else 1,
#             0 if loop_id == '0' else 1,
#         ) + sort_key

#         default_ordering.append((default_key, ploop_key))

#     ploop_ordering.sort()
#     default_ordering.sort()

#     ploop_order = [ploop_key for (_, ploop_key) in ploop_ordering]
#     default_ploop = default_ordering[0][1] if default_ordering else ''

#     return {
#         'ploops': ploops,
#         'ploop_order': ploop_order,
#         'default_ploop': default_ploop,
#         'ploop_keys': ploop_keys,
#     }
