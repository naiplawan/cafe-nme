# POS business rules

## Paid reversals and cash

Paid bills stay paid. Managers approve quantities and reasons on the refund page,
then separately record the actual cash or PromptPay payout. An unpaid `open` bill
can be cancelled without a payment. Existing historical voids remain unchanged.
Cash from historical voided bills still counts in a drawer unless a payout was recorded.

Owners and managers can record drawer top-ups, petty cash and deposits to a bank
or safe from **POS → Shifts**. The logged-in manager is both actor and approver.
Each entry requires a positive amount and a reason; retries reuse its request ID.
Withdrawals cannot exceed expected cash. Closed shifts reject new movements.

Expected cash = opening float + cash payments − actual cash refund payouts
+ top-ups − petty cash − deposits. Closing freezes that expected balance.
Refund approval alone does not move money.

Open **View cash statement** from an active shift or recent closed shift to trace
cash sales, actual cash refunds, top-ups, petty cash and deposits. Entries show
staff, approvers, reasons, payout references and receipt links. Former staff names
remain visible after their accounts are deactivated. Statements paginate at 100
entries; reconciliation totals always cover the whole shift. Active statements
show a consistent snapshot when loaded; reload for later activity. Closed balances
remain frozen, and a warning identifies any difference from the underlying ledger.
The statement is read-only and never changes a closing count.

## Recipes and preparation

In **Admin → Inventory**, a modifier ingredient can be additive or replace an
ingredient in the base recipe. Replacement removes only the base ingredient;
other additive modifiers still apply. Two different selected modifiers cannot
replace the same ingredient. When the base ingredient is absent, the replacement
simply adds its configured ingredient.

Existing shops default to consumption at payment. Enable **consume when starting
preparation** in Inventory to reserve ingredients at payment and consume them when
staff press Start in the queue. Reserved and available quantities are displayed
separately. Sales, waste and negative adjustments cannot spend reserved stock.

Recipes are snapshotted per order item. Editing recipes affects future orders.
Refunding quantities before consumption releases their reservation. A refund
after consumption never restocks ingredients. Fully refunded orders disappear
from the queue. Outstanding preparation reservations remain held across days;
prepare or refund them rather than treating midnight as automatic consumption.
Resolve reservations before changing consumption mode. Changes are audited;
each order retains its consumption mode. Cross-day preparation tracking does not
change the daily queue behavior of payment-mode shops.

The queue's **Remake** form records quantity, reason and actor, consumes the sold
item's recipe again, and creates no payment, revenue or stamps. Insufficient stock
blocks a remake. Refunded quantities cannot be remade. Baristas can remake up to
the remaining sold quantity across requests; further remakes require a manager
or owner. Historical orders without snapshots cannot be remade through this
flow; record their real ingredient use as a reasoned stock movement instead.

## Loyalty and refunds

Only eligible, paid drinks earn stamps. A reward covers one unit of the cheapest
eligible base price, capped at its final unit price. Premium add-ons remain
payable. Equal base prices use the first cart line. Zero-price drinks and the
reward unit earn no stamps, even when add-ons on that reward unit are paid.

The discount belongs to that item, rather than being spread across unrelated
items. When refunding part of a multi-quantity reward line, the reward unit is
returned first: refund only its paid add-ons and reverse no stamp for that unit.
Restore the redeemed reward only after every item in the order has been refunded,
and never revive an expired reward. Historical bills retain their original paid
and stamp allocations.

## Ingredient costs and margins

Enter the total purchase cost in baht on a stock receipt. Use the shop's recognized
ingredient cost, including allocated delivery, with a consistent tax basis.
Weighted-average cost is maintained per ingredient in decimal precision.
The API accepts uncosted receipts only while valuation is unknown; it rejects
missing purchase cost once an ingredient is valued. If existing stock has unknown
cost, a later priced receipt does not invent a value for that stock. Once stock
is exhausted, a priced receipt establishes a known average. Managers can also
use **Set stock value** to value all current stock with an invoice reference or
reason. This records an audit entry, checks the stock quantity has not changed,
and leaves previous sale snapshots untouched.

Checkout snapshots per-unit ingredient costs and total line costs. Later purchases
and recipe edits do not change them. Consumption uses those snapshots; remakes
and waste use the average cost when they are recorded. Positive count adjustments
use the existing average; they do not establish a missing cost.

**Admin → Reports → Ingredient margin** groups by sold item name, uses sales from
the selected bill dates, and subtracts all approved refunds against those bills.
It shows consumed ingredient costs, not yet-unprepared reserved costs. Until those
orders are prepared or refunded, their item margin is withheld and pending
quantities are shown. A prepared refunded
drink retains its cost. Missing recipe/cost history is unknown, never zero;
coverage is shown and a complete margin is withheld for items with missing costs.
Remake and waste costs appear separately by movement date. Labor, rent and other
operating costs are outside this ingredient margin.

## Migration and verification

Apply migrations 0032–0038 before deploying the new API and frontend. No historical
sales, costs, loyalty entries or closed balances are backfilled. Preparation mode
is opt-in. API schemas and generated frontend types are updated together.

Regression coverage includes transactional stock reservations and refunds,
replacement recipe calculations, reward add-on refunds, weighted-average costs,
immutable snapshots, drawer authorization and idempotency, HTTP integration,
and browser workflows described in [POS acceptance](pos-acceptance.md).
