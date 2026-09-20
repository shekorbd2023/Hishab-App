import { run, get } from "./db";
import { uid, nowIso } from "./util";
import { createDocument } from "./actions";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function seedDemo(businessId: string, userId: string, userName: string) {
  const now = nowIso();

  // Accounts (Cash already seeded by createBusinessForUser)
  const accounts: Record<string, string> = {};
  const cash = get<{ id: string }>("SELECT id FROM accounts WHERE business_id = ? AND type='cash'", [businessId]);
  accounts["Cash"] = cash?.id || "";
  for (const [name, type, ob] of [
    ["Dutch Bangla Bank", "bank", 26530],
    ["Bkash", "wallet", 7311],
    ["Nagad", "wallet", 1150],
  ] as [string, string, number][]) {
    const id = uid();
    run("INSERT INTO accounts (id, business_id, name, type, opening_balance, created_at) VALUES (?,?,?,?,?,?)", [
      id, businessId, name, type, ob, now,
    ]);
    accounts[name] = id;
  }

  // Item categories
  for (const c of ["Grains And Puffed Rice", "Ghee", "Honey", "Dry Food", "Shemai"]) {
    run("INSERT INTO categories (id, business_id, kind, name) VALUES (?,?,?,?)", [uid(), businessId, "item", c]);
  }

  // Items
  const items: { id: string; name: string; sp: number; pp: number }[] = [];
  const itemData: [string, string, number, number, number][] = [
    ["Barley Sattu 500gm", "Grains And Puffed Rice", 200, 120, 10],
    ["Aman Red Muri 500gm", "Grains And Puffed Rice", 110, 65, 24],
    ["Shor Ghee (Sirajgonj) 250gm", "Ghee", 480, 327.5, 5],
    ["Shor Ghee (Sirajgonj) 500gm", "Ghee", 900, 645, 8],
    ["Lal Ata", "Grains And Puffed Rice", 110, 70, 8],
    ["Plum Honey", "Honey", 950, 570, 6],
    ["Mustard Oil 1L", "Dry Food", 320, 250, 20],
    ["Date Molasses 500gm", "Dry Food", 260, 180, 15],
    ["Lachcha Shemai 200gm", "Shemai", 90, 55, 30],
    ["Black Cumin Honey 250gm", "Honey", 520, 340, 9],
  ];
  for (const [name, cat, sp, pp, stock] of itemData) {
    const id = uid();
    run(
      `INSERT INTO items (id, business_id, name, category, type, sales_price, purchase_price, mrp_price, wholesale_price, min_wholesale_qty, unit, opening_stock, low_stock_alert, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, businessId, name, cat, "Product", sp, pp, sp, Math.round(sp * 0.9), 5, "pcs", stock, 5, now]
    );
    items.push({ id, name, sp, pp });
  }

  // Parties
  const parties: { id: string; name: string }[] = [];
  const partyNames = [
    "Atikul Islam", "Shahrirar Muhammad", "Abdullah Al Mamun", "Wasif Rahman", "Nilufar Yeasmin",
    "Mehedi Hasan Khan", "Jaine Akter", "Shahinur Binte Alam", "Rafiq Traders", "Karim Store",
  ];
  for (const name of partyNames) {
    const id = uid();
    run("INSERT INTO parties (id, business_id, name, type, opening_balance, created_at) VALUES (?,?,?,?,?,?)", [
      id, businessId, name, "customer", 0, now,
    ]);
    parties.push({ id, name });
  }
  // one supplier
  const supplierId = uid();
  run("INSERT INTO parties (id, business_id, name, type, opening_balance, created_at) VALUES (?,?,?,?,?,?)", [
    supplierId, businessId, "Grihosto Enterprise", "supplier", 0, now,
  ]);

  // Sales invoices across last ~40 days
  for (let i = 0; i < 18; i++) {
    const party = parties[i % parties.length];
    const it1 = items[i % items.length];
    const it2 = items[(i + 3) % items.length];
    const q1 = 1 + (i % 4);
    const q2 = 1 + ((i + 1) % 3);
    const total = it1.sp * q1 + it2.sp * q2;
    const paid = i % 3 === 0 ? 0 : total; // some unpaid
    createDocument({
      businessId,
      kind: "sales_invoice",
      partyId: party.id,
      date: daysAgo(40 - i * 2),
      lines: [
        { itemId: it1.id, name: it1.name, qty: q1, rate: it1.sp },
        { itemId: it2.id, name: it2.name, qty: q2, rate: it2.sp },
      ],
      paidAmount: paid,
      accountId: accounts["Cash"],
      paymentMode: "Cash",
      createdBy: userName,
    });
  }

  // Purchases from supplier
  for (let i = 0; i < 4; i++) {
    const it = items[i];
    createDocument({
      businessId,
      kind: "purchase_bill",
      partyId: supplierId,
      date: daysAgo(35 - i * 5),
      lines: [{ itemId: it.id, name: it.name, qty: 20, rate: it.pp }],
      paidAmount: i % 2 === 0 ? it.pp * 20 : 0,
      accountId: accounts["Dutch Bangla Bank"],
      paymentMode: "Bank",
      createdBy: userName,
    });
  }

  // Expenses
  const expCats = ["Rent", "Utilities", "Transport", "Salary"];
  for (let i = 0; i < 6; i++) {
    run(
      "INSERT INTO expenses (id, business_id, category, account_id, amount, date, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [uid(), businessId, expCats[i % expCats.length], accounts["Cash"], 500 + i * 250, daysAgo(30 - i * 4), "Monthly", userName, now]
    );
  }
  // Other income
  run(
    "INSERT INTO incomes (id, business_id, category, account_id, amount, date, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [uid(), businessId, "Commission", accounts["Bkash"], 1200, daysAgo(10), "Referral", userName, now]
  );

  // A reminder
  const remDate = new Date();
  remDate.setDate(remDate.getDate() + 3);
  run("INSERT INTO reminders (id, business_id, party_id, due_date, note, done, created_at) VALUES (?,?,?,?,?,?,?)", [
    uid(), businessId, parties[2].id, remDate.toISOString().slice(0, 10), "Collect due payment", 0, now,
  ]);
}
