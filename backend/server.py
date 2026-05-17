from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
APP_PIN = os.environ.get('APP_PIN', '1234')

app = FastAPI(title="Manino Coffee CRM")
api_router = APIRouter(prefix="/api")

ClientType = Literal["Particular", "Empresa"]
OrderStatus = Literal["pendiente", "entregado"]
ExpenseStatus = Literal["pendiente", "cancelado"]
SupplierOrderStatus = Literal["pendiente", "completado"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PinIn(BaseModel):
    pin: str


class ClientIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    business_name: str
    contact_name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    location: Optional[str] = ""
    client_type: ClientType = "Particular"
    notes: Optional[str] = ""


class Client(ClientIn):
    id: str
    created_at: str


class CategoryIn(BaseModel):
    name: str


class Category(CategoryIn):
    id: str
    created_at: str


class ProductIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    category_id: Optional[str] = None
    category_name: Optional[str] = ""
    price: float
    cost: float = 0
    stock: float = 0
    low_stock_threshold: float = 5
    unit: Optional[str] = "u"
    description: Optional[str] = ""


class Product(ProductIn):
    id: str
    created_at: str


class OrderItemIn(BaseModel):
    product_id: str
    quantity: float


class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: float
    unit_price: float
    subtotal: float


class OrderIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    client_id: str
    items: List[OrderItemIn]
    status: OrderStatus = "pendiente"
    paid: bool = False
    notes: Optional[str] = ""
    delivery_location: Optional[str] = ""
    delivery_date: Optional[str] = ""  # YYYY-MM-DD
    delivery_time: Optional[str] = ""  # HH:MM (24h)


class Order(BaseModel):
    id: str
    client_id: str
    client_name: str
    items: List[OrderItem]
    total: float
    status: OrderStatus
    paid: bool = False
    paid_at: Optional[str] = None
    notes: Optional[str] = ""
    created_at: str
    delivered_at: Optional[str] = None
    delivery_location: Optional[str] = ""
    delivery_date: Optional[str] = ""
    delivery_time: Optional[str] = ""


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderPaidUpdate(BaseModel):
    paid: bool


class ClientNoteIn(BaseModel):
    body: str


class ClientNote(BaseModel):
    id: str
    client_id: str
    body: str
    created_at: str


class InvoiceItemIn(BaseModel):
    invoice_name: str
    quantity: float
    matched_product_id: Optional[str] = None


class InvoiceItem(BaseModel):
    invoice_name: str
    quantity: float
    matched_product_id: Optional[str] = None
    matched_product_name: Optional[str] = None


class InvoiceIn(BaseModel):
    supplier: Optional[str] = ""
    notes: Optional[str] = ""
    items: List[InvoiceItemIn]


class Invoice(BaseModel):
    id: str
    supplier: Optional[str] = ""
    notes: Optional[str] = ""
    items: List[InvoiceItem]
    created_at: str


class SupplierIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    contact_name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    notes: Optional[str] = ""


class Supplier(SupplierIn):
    id: str
    created_at: str


class GoalIn(BaseModel):
    month: str
    target: float


class ExpenseIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    description: str
    amount: float
    category: Optional[str] = ""
    date: Optional[str] = None  # ISO date string
    status: ExpenseStatus = "pendiente"
    notes: Optional[str] = ""


class Expense(ExpenseIn):
    id: str
    created_at: str


class ExpenseStatusUpdate(BaseModel):
    status: ExpenseStatus


class SupplierOrderIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: Optional[str] = None
    product_name: str
    quantity: float
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = ""
    order_date: str  # ISO date string YYYY-MM-DD or full ISO datetime
    status: SupplierOrderStatus = "pendiente"
    notes: Optional[str] = ""


class SupplierOrder(SupplierOrderIn):
    id: str
    created_at: str


class SupplierOrderStatusUpdate(BaseModel):
    status: SupplierOrderStatus


PROJECTION = {"_id": 0}


async def seed_default_categories():
    existing = await db.categories.count_documents({})
    if existing == 0:
        for name in ["Café", "Accesorios", "Alimentos"]:
            await db.categories.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "created_at": now_iso(),
            })


async def migrate_orders_status():
    await db.orders.update_many({"status": "en_proceso"}, {"$set": {"status": "pendiente"}})


@app.on_event("startup")
async def _startup():
    await seed_default_categories()
    await migrate_orders_status()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ---- Auth ----
@api_router.post("/auth/verify-pin")
async def verify_pin(payload: PinIn):
    if payload.pin == APP_PIN:
        return {"ok": True}
    raise HTTPException(401, "PIN incorrecto")


# ---- Clients ----
@api_router.get("/clients", response_model=List[Client])
async def list_clients():
    return await db.clients.find({}, PROJECTION).sort("created_at", -1).to_list(10000)


@api_router.post("/clients", response_model=Client)
async def create_client(payload: ClientIn):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.clients.insert_one(doc.copy())
    return Client(**doc)


@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str):
    doc = await db.clients.find_one({"id": client_id}, PROJECTION)
    if not doc:
        raise HTTPException(404, "Cliente no encontrado")
    return doc


@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, payload: ClientIn):
    res = await db.clients.find_one_and_update(
        {"id": client_id}, {"$set": payload.model_dump()},
        projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Cliente no encontrado")
    return res


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    res = await db.clients.delete_one({"id": client_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Cliente no encontrado")
    await db.client_notes.delete_many({"client_id": client_id})
    return {"ok": True}


@api_router.get("/clients/{client_id}/orders", response_model=List[Order])
async def client_orders(client_id: str):
    return await db.orders.find({"client_id": client_id}, PROJECTION).sort("created_at", -1).to_list(1000)


# ---- Client notes ----
@api_router.get("/clients/{client_id}/notes", response_model=List[ClientNote])
async def list_client_notes(client_id: str):
    return await db.client_notes.find({"client_id": client_id}, PROJECTION).sort("created_at", -1).to_list(1000)


@api_router.post("/clients/{client_id}/notes", response_model=ClientNote)
async def create_client_note(client_id: str, payload: ClientNoteIn):
    body = payload.body.strip()
    if not body:
        raise HTTPException(400, "La nota no puede estar vacía")
    if not await db.clients.find_one({"id": client_id}, PROJECTION):
        raise HTTPException(404, "Cliente no encontrado")
    doc = {"id": str(uuid.uuid4()), "client_id": client_id, "body": body, "created_at": now_iso()}
    await db.client_notes.insert_one(doc.copy())
    return doc


@api_router.delete("/clients/{client_id}/notes/{note_id}")
async def delete_client_note(client_id: str, note_id: str):
    res = await db.client_notes.delete_one({"id": note_id, "client_id": client_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Nota no encontrada")
    return {"ok": True}


# ---- Categories ----
@api_router.get("/categories", response_model=List[Category])
async def list_categories():
    return await db.categories.find({}, PROJECTION).sort("name", 1).to_list(1000)


@api_router.post("/categories", response_model=Category)
async def create_category(payload: CategoryIn):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Nombre requerido")
    existing = await db.categories.find_one({"name": name}, PROJECTION)
    if existing:
        return existing
    doc = {"id": str(uuid.uuid4()), "name": name, "created_at": now_iso()}
    await db.categories.insert_one(doc.copy())
    return doc


@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    in_use = await db.products.count_documents({"category_id": category_id})
    if in_use:
        raise HTTPException(400, f"No se puede borrar: {in_use} producto(s) usan esta categoría")
    res = await db.categories.delete_one({"id": category_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Categoría no encontrada")
    return {"ok": True}


# ---- Products ----
@api_router.get("/products", response_model=List[Product])
async def list_products():
    return await db.products.find({}, PROJECTION).sort("name", 1).to_list(10000)


@api_router.get("/products/search")
async def search_products(q: str = ""):
    if not q.strip():
        results = await db.products.find({}, PROJECTION).sort("name", 1).to_list(20)
    else:
        results = await db.products.find(
            {"name": {"$regex": q.strip(), "$options": "i"}}, PROJECTION
        ).sort("name", 1).to_list(20)
    return results


@api_router.post("/products", response_model=Product)
async def create_product(payload: ProductIn):
    doc = payload.model_dump()
    if doc.get("category_id"):
        cat = await db.categories.find_one({"id": doc["category_id"]}, PROJECTION)
        doc["category_name"] = cat["name"] if cat else ""
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.products.insert_one(doc.copy())
    return Product(**doc)


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, payload: ProductIn):
    update = payload.model_dump()
    if update.get("category_id"):
        cat = await db.categories.find_one({"id": update["category_id"]}, PROJECTION)
        update["category_name"] = cat["name"] if cat else ""
    res = await db.products.find_one_and_update(
        {"id": product_id}, {"$set": update}, projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Producto no encontrado")
    return res


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    return {"ok": True}


# ---- Orders ----
@api_router.get("/orders", response_model=List[Order])
async def list_orders(status: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None):
    query: dict = {}
    if status:
        query["status"] = status
    if start or end:
        query["created_at"] = {}
        if start:
            query["created_at"]["$gte"] = start
        if end:
            query["created_at"]["$lte"] = end
    return await db.orders.find(query, PROJECTION).sort("created_at", -1).to_list(10000)


@api_router.post("/orders", response_model=Order)
async def create_order(payload: OrderIn):
    if not payload.items:
        raise HTTPException(400, "El pedido debe tener al menos un producto")
    client_doc = await db.clients.find_one({"id": payload.client_id}, PROJECTION)
    if not client_doc:
        raise HTTPException(404, "Cliente no encontrado")
    enriched_items: List[OrderItem] = []
    total = 0.0
    for it in payload.items:
        prod = await db.products.find_one({"id": it.product_id}, PROJECTION)
        if not prod:
            raise HTTPException(404, f"Producto {it.product_id} no encontrado")
        if it.quantity <= 0:
            raise HTTPException(400, f"Cantidad inválida para {prod['name']}")
        if prod.get("stock", 0) < it.quantity:
            raise HTTPException(400, f"Stock insuficiente para {prod['name']} (disponible: {prod.get('stock', 0)})")
        subtotal = float(prod["price"]) * float(it.quantity)
        enriched_items.append(OrderItem(
            product_id=prod["id"], product_name=prod["name"], quantity=it.quantity,
            unit_price=float(prod["price"]), subtotal=subtotal,
        ))
        total += subtotal
    order_id = str(uuid.uuid4())
    created = now_iso()
    paid_at = created if payload.paid else None
    order_doc = {
        "id": order_id, "client_id": payload.client_id, "client_name": client_doc["business_name"],
        "items": [i.model_dump() for i in enriched_items], "total": round(total, 2),
        "status": payload.status, "paid": payload.paid, "paid_at": paid_at,
        "notes": payload.notes or "", "created_at": created,
        "delivered_at": created if payload.status == "entregado" else None,
        "delivery_location": (payload.delivery_location or "").strip(),
        "delivery_date": (payload.delivery_date or "").strip(),
        "delivery_time": (payload.delivery_time or "").strip(),
    }
    await db.orders.insert_one(order_doc.copy())
    for it in enriched_items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.quantity}})
    return Order(**order_doc)


@api_router.put("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, payload: OrderStatusUpdate):
    update = {"status": payload.status}
    if payload.status == "entregado":
        update["delivered_at"] = now_iso()
    res = await db.orders.find_one_and_update(
        {"id": order_id}, {"$set": update}, projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Pedido no encontrado")
    return res


@api_router.put("/orders/{order_id}/paid", response_model=Order)
async def update_order_paid(order_id: str, payload: OrderPaidUpdate):
    update: dict = {"paid": payload.paid}
    update["paid_at"] = now_iso() if payload.paid else None
    res = await db.orders.find_one_and_update(
        {"id": order_id}, {"$set": update}, projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Pedido no encontrado")
    return res


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, PROJECTION)
    if not order:
        raise HTTPException(404, "Pedido no encontrado")
    for item in order.get("items", []):
        await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": item["quantity"]}})
    await db.orders.delete_one({"id": order_id})
    return {"ok": True}


# ---- Invoices (Recibimiento de mercadería) ----
@api_router.get("/invoices", response_model=List[Invoice])
async def list_invoices():
    return await db.invoices.find({}, PROJECTION).sort("created_at", -1).to_list(1000)


@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(payload: InvoiceIn):
    if not payload.items:
        raise HTTPException(400, "La factura debe tener al menos un ítem")
    enriched_items = []
    for item in payload.items:
        matched_name = None
        if item.matched_product_id:
            prod = await db.products.find_one({"id": item.matched_product_id}, PROJECTION)
            if prod:
                matched_name = prod["name"]
                await db.products.update_one(
                    {"id": item.matched_product_id},
                    {"$inc": {"stock": item.quantity}}
                )
        enriched_items.append({
            "invoice_name": item.invoice_name,
            "quantity": item.quantity,
            "matched_product_id": item.matched_product_id,
            "matched_product_name": matched_name,
        })
    doc = {
        "id": str(uuid.uuid4()),
        "supplier": payload.supplier or "",
        "notes": payload.notes or "",
        "items": enriched_items,
        "created_at": now_iso(),
    }
    await db.invoices.insert_one(doc.copy())
    return doc


@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id}, PROJECTION)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")
    for item in invoice.get("items", []):
        if item.get("matched_product_id"):
            await db.products.update_one(
                {"id": item["matched_product_id"]},
                {"$inc": {"stock": -item["quantity"]}}
            )
    await db.invoices.delete_one({"id": invoice_id})
    return {"ok": True}


# ---- Dashboard & Analytics ----
def _parse_iso(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def _parse_date_any(s: str) -> Optional[datetime]:
    """Acepta YYYY-MM-DD o ISO completo."""
    if not s:
        return None
    try:
        if "T" in s or "+" in s or "Z" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        # asume fecha simple → al inicio del día UTC
        d = datetime.strptime(s, "%Y-%m-%d")
        return d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _expense_effective_dt(exp: dict) -> datetime:
    """Fecha contable del gasto: usa 'date' si está, sino 'created_at'."""
    dt = _parse_date_any(exp.get("date") or "") if exp.get("date") else None
    if dt is None:
        dt = _parse_iso(exp.get("created_at", ""))
    return dt


async def _sales_velocity(product_id: str, days: int = 30) -> float:
    """Promedio de unidades vendidas por día en los últimos `days` días para un producto."""
    if not product_id:
        return 0.0
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    orders = await db.orders.find({"created_at": {"$gte": cutoff.isoformat()}}, PROJECTION).to_list(100000)
    total = 0.0
    for o in orders:
        for it in o.get("items", []):
            if it.get("product_id") == product_id:
                total += float(it.get("quantity", 0))
    return total / max(days, 1)


async def _recommend_qty(product_id: str, coverage_days: int = 14) -> dict:
    """Recomendación de cantidad a pedir basada en flujo histórico."""
    vel = await _sales_velocity(product_id, days=30)
    product = await db.products.find_one({"id": product_id}, PROJECTION) if product_id else None
    current_stock = float(product.get("stock", 0)) if product else 0.0
    projected_need = vel * coverage_days
    recommended = max(0.0, projected_need - current_stock)
    return {
        "avg_daily_sales": round(vel, 2),
        "current_stock": current_stock,
        "coverage_days": coverage_days,
        "projected_need": round(projected_need, 2),
        "recommended_qty": round(recommended, 2) if recommended > 0 else round(projected_need, 2),
    }


@api_router.get("/dashboard/stats")
async def dashboard_stats():
    now = datetime.now(timezone.utc)
    start_30 = now - timedelta(days=30)
    start_7 = now - timedelta(days=7)
    cutoff_moroso = now - timedelta(days=7)
    orders = await db.orders.find({}, PROJECTION).to_list(100000)
    clients_count = await db.clients.count_documents({})
    products = await db.products.find({}, PROJECTION).to_list(10000)
    expenses = await db.expenses.find({}, PROJECTION).to_list(100000)

    # Revenue counts only paid orders
    total_sales = sum(o.get("total", 0) for o in orders if o.get("paid", False))
    total_orders = len(orders)
    avg_ticket = (total_sales / total_orders) if total_orders else 0
    sales_30 = orders_30 = sales_7 = 0
    for o in orders:
        if not o.get("paid", False):
            continue
        dt = _parse_iso(o["created_at"])
        if dt >= start_30:
            sales_30 += o.get("total", 0); orders_30 += 1
        if dt >= start_7:
            sales_7 += o.get("total", 0)

    trend_map = defaultdict(float); order_count_map = defaultdict(int)
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        trend_map[day] = 0.0; order_count_map[day] = 0
    for o in orders:
        if not o.get("paid", False):
            continue
        day = _parse_iso(o["created_at"]).date().isoformat()
        if day in trend_map:
            trend_map[day] += o.get("total", 0); order_count_map[day] += 1
    trend = [{"date": d, "sales": round(trend_map[d], 2), "orders": order_count_map[d]} for d in sorted(trend_map.keys())]

    by_client = defaultdict(lambda: {"client_id": "", "client_name": "", "total": 0, "orders": 0})
    for o in orders:
        if not o.get("paid", False):
            continue
        c = by_client[o["client_id"]]
        c["client_id"] = o["client_id"]; c["client_name"] = o["client_name"]
        c["total"] += o.get("total", 0); c["orders"] += 1
    top_clients = sorted(by_client.values(), key=lambda x: x["total"], reverse=True)[:5]
    for tc in top_clients: tc["total"] = round(tc["total"], 2)

    by_prod = defaultdict(lambda: {"product_id": "", "product_name": "", "quantity": 0, "revenue": 0})
    for o in orders:
        for it in o.get("items", []):
            p = by_prod[it["product_id"]]
            p["product_id"] = it["product_id"]; p["product_name"] = it["product_name"]
            p["quantity"] += it["quantity"]; p["revenue"] += it["subtotal"]
    top_products = sorted(by_prod.values(), key=lambda x: x["revenue"], reverse=True)[:5]
    for tp in top_products: tp["revenue"] = round(tp["revenue"], 2)

    low_stock = [{"id": p["id"], "name": p["name"], "stock": p.get("stock", 0), "threshold": p.get("low_stock_threshold", 0)}
                 for p in products if p.get("stock", 0) <= p.get("low_stock_threshold", 0)]

    status_counts = {"pendiente": 0, "entregado": 0, "paid": 0}
    for o in orders:
        s = o.get("status", "pendiente")
        if s == "en_proceso":  # legacy
            s = "pendiente"
        status_counts[s] = status_counts.get(s, 0) + 1
        if o.get("paid", False):
            status_counts["paid"] += 1

    morosos = []
    for o in orders:
        if o.get("status") == "entregado" and not o.get("paid", False):
            delivered_at = o.get("delivered_at")
            if delivered_at and _parse_iso(delivered_at) < cutoff_moroso:
                morosos.append({
                    "order_id": o["id"],
                    "client_id": o["client_id"],
                    "client_name": o["client_name"],
                    "total": o["total"],
                    "delivered_at": delivered_at,
                    "days_overdue": (now - _parse_iso(delivered_at)).days,
                })
    morosos.sort(key=lambda x: x["days_overdue"], reverse=True)

    # ---- Gastos: solo "cancelado" se descuenta ----
    expenses_cancelled_total = sum(float(e.get("amount", 0)) for e in expenses if e.get("status") == "cancelado")
    expenses_pending_total = sum(float(e.get("amount", 0)) for e in expenses if e.get("status") == "pendiente")

    net_profit = total_sales - expenses_cancelled_total
    breakdown = {
        "salary_10": round(max(0.0, net_profit) * 0.10, 2),
        "funds_20": round(max(0.0, net_profit) * 0.20, 2),
        "reinvest_70": round(max(0.0, net_profit) * 0.70, 2),
    }

    # ---- Balance mensual (últimos 12 meses) ----
    monthly_acc: dict = {}
    y, m = now.year, now.month
    months_seq = []
    for _ in range(12):
        months_seq.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    for key in reversed(months_seq):  # antiguo → reciente
        monthly_acc[key] = {"month": key, "sales": 0.0, "expenses": 0.0}
    for o in orders:
        if not o.get("paid", False):
            continue
        key = _parse_iso(o["created_at"]).strftime("%Y-%m")
        if key in monthly_acc:
            monthly_acc[key]["sales"] += float(o.get("total", 0))
    for e in expenses:
        if e.get("status") != "cancelado":
            continue
        key = _expense_effective_dt(e).strftime("%Y-%m")
        if key in monthly_acc:
            monthly_acc[key]["expenses"] += float(e.get("amount", 0))
    monthly_balance = []
    for key, m in monthly_acc.items():
        net = m["sales"] - m["expenses"]
        positive = max(0.0, net)
        monthly_balance.append({
            "month": key,
            "sales": round(m["sales"], 2),
            "expenses": round(m["expenses"], 2),
            "net": round(net, 2),
            "salary_10": round(positive * 0.10, 2),
            "funds_20": round(positive * 0.20, 2),
            "reinvest_70": round(positive * 0.70, 2),
        })

    # ---- Alertas de pedidos a proveedores (24h antes) ----
    supplier_orders = await db.supplier_orders.find({"status": "pendiente"}, PROJECTION).to_list(1000)
    alerts = []
    in_24h = now + timedelta(hours=24)
    for so in supplier_orders:
        dt = _parse_date_any(so.get("order_date", ""))
        if not dt:
            continue
        if now <= dt <= in_24h or dt < now:
            rec = await _recommend_qty(so.get("product_id"))
            alerts.append({
                "id": so["id"],
                "product_id": so.get("product_id"),
                "product_name": so.get("product_name"),
                "supplier_name": so.get("supplier_name") or "",
                "order_date": so.get("order_date"),
                "hours_until": round((dt - now).total_seconds() / 3600, 1),
                "recommended_qty": rec["recommended_qty"],
                "avg_daily_sales": rec["avg_daily_sales"],
                "current_stock": rec["current_stock"],
            })

    return {
        "kpis": {"total_sales": round(total_sales, 2), "total_orders": total_orders, "avg_ticket": round(avg_ticket, 2),
                 "total_clients": clients_count, "total_products": len(products),
                 "sales_30d": round(sales_30, 2), "orders_30d": orders_30, "sales_7d": round(sales_7, 2)},
        "trend_14d": trend, "top_clients": top_clients, "top_products": top_products,
        "low_stock": low_stock, "status_counts": status_counts, "morosos": morosos,
        "expenses": {
            "cancelled_total": round(expenses_cancelled_total, 2),
            "pending_total": round(expenses_pending_total, 2),
        },
        "balance": {
            "net_profit": round(net_profit, 2),
            "salary_10": breakdown["salary_10"],
            "funds_20": breakdown["funds_20"],
            "reinvest_70": breakdown["reinvest_70"],
        },
        "monthly_balance": monthly_balance,
        "supplier_order_alerts": alerts,
    }


@api_router.get("/analytics")
async def analytics():
    orders = await db.orders.find({}, PROJECTION).to_list(100000)
    clients = await db.clients.find({}, PROJECTION).to_list(10000)
    per_client = defaultdict(lambda: {"client_id": "", "client_name": "", "total": 0.0, "orders": 0, "dates": []})
    for o in orders:
        c = per_client[o["client_id"]]
        c["client_id"] = o["client_id"]; c["client_name"] = o["client_name"]
        c["total"] += o.get("total", 0); c["orders"] += 1
        c["dates"].append(_parse_iso(o["created_at"]))
    client_stats = []
    for cid, c in per_client.items():
        dates = sorted(c["dates"])
        freq_days = None
        if len(dates) >= 2:
            deltas = [(dates[i] - dates[i - 1]).total_seconds() / 86400 for i in range(1, len(dates))]
            freq_days = round(sum(deltas) / len(deltas), 1)
        client_stats.append({
            "client_id": c["client_id"], "client_name": c["client_name"],
            "total_spent": round(c["total"], 2), "orders_count": c["orders"],
            "avg_order_value": round(c["total"] / c["orders"], 2) if c["orders"] else 0,
            "avg_days_between_orders": freq_days,
            "last_order_at": dates[-1].isoformat() if dates else None,
        })
    client_stats.sort(key=lambda x: x["total_spent"], reverse=True)
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        m = (now.replace(day=1) - timedelta(days=i * 30))
        months.append(m.strftime("%Y-%m"))
    seen = set(); months = [m for m in months if not (m in seen or seen.add(m))]
    monthly_map = {m: {"month": m, "sales": 0.0, "orders": 0} for m in months}
    for o in orders:
        key = _parse_iso(o["created_at"]).strftime("%Y-%m")
        if key in monthly_map:
            monthly_map[key]["sales"] += o.get("total", 0); monthly_map[key]["orders"] += 1
    monthly = list(monthly_map.values())
    for m in monthly: m["sales"] = round(m["sales"], 2)
    growth_pct = None
    if len(monthly) >= 2 and monthly[-2]["sales"] > 0:
        growth_pct = round(((monthly[-1]["sales"] - monthly[-2]["sales"]) / monthly[-2]["sales"]) * 100, 1)
    return {
        "client_stats": client_stats, "monthly": monthly, "growth_pct": growth_pct,
        "overall_avg_order_value": round((sum(o.get("total", 0) for o in orders) / len(orders)) if orders else 0, 2),
        "total_clients": len(clients),
        "active_clients": sum(1 for c in client_stats if c["orders_count"] > 0),
    }


# ---- Suppliers ----
@api_router.get("/suppliers", response_model=List[Supplier])
async def list_suppliers():
    return await db.suppliers.find({}, PROJECTION).sort("name", 1).to_list(1000)


@api_router.post("/suppliers", response_model=Supplier)
async def create_supplier(payload: SupplierIn):
    if not payload.name.strip():
        raise HTTPException(400, "Nombre requerido")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.suppliers.insert_one(doc.copy())
    return Supplier(**doc)


@api_router.put("/suppliers/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: str, payload: SupplierIn):
    res = await db.suppliers.find_one_and_update(
        {"id": supplier_id}, {"$set": payload.model_dump()},
        projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Proveedor no encontrado")
    return res


@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str):
    res = await db.suppliers.delete_one({"id": supplier_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Proveedor no encontrado")
    return {"ok": True}


# ---- Goals / Settings ----
@api_router.get("/settings/goals")
async def get_goal(month: str = ""):
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    doc = await db.settings.find_one({"key": f"goal_{month}"}, PROJECTION)
    return {"month": month, "target": doc["target"] if doc else 0}


@api_router.put("/settings/goals")
async def upsert_goal(payload: GoalIn):
    await db.settings.update_one(
        {"key": f"goal_{payload.month}"},
        {"$set": {"key": f"goal_{payload.month}", "month": payload.month, "target": payload.target}},
        upsert=True,
    )
    return {"month": payload.month, "target": payload.target}


# ---- Expenses (Gastos) ----
@api_router.get("/expenses", response_model=List[Expense])
async def list_expenses(status: Optional[str] = None):
    query: dict = {}
    if status:
        query["status"] = status
    return await db.expenses.find(query, PROJECTION).sort("created_at", -1).to_list(10000)


@api_router.post("/expenses", response_model=Expense)
async def create_expense(payload: ExpenseIn):
    if payload.amount <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")
    if not payload.description.strip():
        raise HTTPException(400, "Descripción requerida")
    doc = payload.model_dump()
    if not doc.get("date"):
        doc["date"] = datetime.now(timezone.utc).date().isoformat()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.expenses.insert_one(doc.copy())
    return Expense(**doc)


@api_router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, payload: ExpenseIn):
    res = await db.expenses.find_one_and_update(
        {"id": expense_id}, {"$set": payload.model_dump()},
        projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Gasto no encontrado")
    return res


@api_router.put("/expenses/{expense_id}/status", response_model=Expense)
async def update_expense_status(expense_id: str, payload: ExpenseStatusUpdate):
    res = await db.expenses.find_one_and_update(
        {"id": expense_id}, {"$set": {"status": payload.status}},
        projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Gasto no encontrado")
    return res


@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str):
    res = await db.expenses.delete_one({"id": expense_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Gasto no encontrado")
    return {"ok": True}


# ---- Supplier orders (Pedidos a proveedores) ----
@api_router.get("/supplier-orders", response_model=List[SupplierOrder])
async def list_supplier_orders(status: Optional[str] = None):
    query: dict = {}
    if status:
        query["status"] = status
    return await db.supplier_orders.find(query, PROJECTION).sort("order_date", 1).to_list(10000)


@api_router.post("/supplier-orders", response_model=SupplierOrder)
async def create_supplier_order(payload: SupplierOrderIn):
    if payload.quantity <= 0:
        raise HTTPException(400, "Cantidad debe ser mayor a 0")
    if not payload.product_name.strip():
        raise HTTPException(400, "Producto requerido")
    doc = payload.model_dump()
    # Enriquecer con nombre si vienen ids
    if doc.get("product_id"):
        prod = await db.products.find_one({"id": doc["product_id"]}, PROJECTION)
        if prod:
            doc["product_name"] = prod["name"]
    if doc.get("supplier_id"):
        sup = await db.suppliers.find_one({"id": doc["supplier_id"]}, PROJECTION)
        if sup:
            doc["supplier_name"] = sup["name"]
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.supplier_orders.insert_one(doc.copy())
    return SupplierOrder(**doc)


@api_router.put("/supplier-orders/{order_id}", response_model=SupplierOrder)
async def update_supplier_order(order_id: str, payload: SupplierOrderIn):
    update = payload.model_dump()
    if update.get("product_id"):
        prod = await db.products.find_one({"id": update["product_id"]}, PROJECTION)
        if prod:
            update["product_name"] = prod["name"]
    if update.get("supplier_id"):
        sup = await db.suppliers.find_one({"id": update["supplier_id"]}, PROJECTION)
        if sup:
            update["supplier_name"] = sup["name"]
    res = await db.supplier_orders.find_one_and_update(
        {"id": order_id}, {"$set": update},
        projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Pedido a proveedor no encontrado")
    return res


@api_router.put("/supplier-orders/{order_id}/status", response_model=SupplierOrder)
async def update_supplier_order_status(order_id: str, payload: SupplierOrderStatusUpdate):
    res = await db.supplier_orders.find_one_and_update(
        {"id": order_id}, {"$set": {"status": payload.status}},
        projection=PROJECTION, return_document=True,
    )
    if not res:
        raise HTTPException(404, "Pedido no encontrado")
    return res


@api_router.delete("/supplier-orders/{order_id}")
async def delete_supplier_order(order_id: str):
    res = await db.supplier_orders.delete_one({"id": order_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Pedido no encontrado")
    return {"ok": True}


@api_router.get("/supplier-orders/recommendation")
async def supplier_order_recommendation(product_id: str, coverage_days: int = 14):
    return await _recommend_qty(product_id, coverage_days=coverage_days)


# ---- Reporte semanal ----
CR_OFFSET = timedelta(hours=-6)  # Costa Rica UTC-6


def _cr_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(timezone(CR_OFFSET))


def _week_range_cr(reference: Optional[datetime] = None) -> tuple[datetime, datetime, str, str]:
    """Devuelve (start_utc, end_utc, start_label, end_label) para la semana lun-dom en CR."""
    ref = reference or _cr_now()
    # weekday(): lunes=0 ... domingo=6
    monday_cr = (ref - timedelta(days=ref.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    sunday_cr = monday_cr + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return (
        monday_cr.astimezone(timezone.utc),
        sunday_cr.astimezone(timezone.utc),
        monday_cr.date().isoformat(),
        sunday_cr.date().isoformat(),
    )


@api_router.get("/reports/weekly")
async def weekly_report(start: Optional[str] = None, end: Optional[str] = None):
    """Reporte semanal: ingresos (pedidos pagados), gastos cancelados, neto, desglose 10/20/70.
    Si no se pasa start/end, usa lun-dom de la semana en curso (CR)."""
    if start and end:
        start_dt = _parse_date_any(start)
        end_dt = _parse_date_any(end)
        if not start_dt or not end_dt:
            raise HTTPException(400, "Fechas inválidas")
        # Ajustar end al final del día
        end_dt = end_dt.replace(hour=23, minute=59, second=59)
        start_label = start_dt.date().isoformat()
        end_label = end_dt.date().isoformat()
        start_utc = start_dt.astimezone(timezone.utc)
        end_utc = end_dt.astimezone(timezone.utc)
    else:
        start_utc, end_utc, start_label, end_label = _week_range_cr()

    start_iso = start_utc.isoformat()
    end_iso = end_utc.isoformat()

    # Ingresos: pedidos pagados con paid_at en el rango (o created_at si no hay paid_at)
    orders = await db.orders.find({"paid": True}, PROJECTION).to_list(100000)
    income_total = 0.0
    daily = {(start_utc + timedelta(days=i)).date().isoformat(): {"income": 0.0, "expense": 0.0}
             for i in range(7)}
    income_orders = []
    for o in orders:
        ref_str = o.get("paid_at") or o.get("created_at")
        if not ref_str:
            continue
        dt = _parse_iso(ref_str)
        if start_utc <= dt <= end_utc:
            amount = float(o.get("total", 0))
            income_total += amount
            day = dt.astimezone(timezone(CR_OFFSET)).date().isoformat()
            if day in daily:
                daily[day]["income"] += amount
            income_orders.append({
                "id": o["id"],
                "client_name": o.get("client_name", ""),
                "total": amount,
                "at": ref_str,
            })

    # Gastos cancelados con fecha efectiva en el rango
    expenses = await db.expenses.find({"status": "cancelado"}, PROJECTION).to_list(100000)
    expense_total = 0.0
    expense_items = []
    for e in expenses:
        dt = _expense_effective_dt(e)
        if start_utc <= dt <= end_utc:
            amount = float(e.get("amount", 0))
            expense_total += amount
            day = dt.astimezone(timezone(CR_OFFSET)).date().isoformat()
            if day in daily:
                daily[day]["expense"] += amount
            expense_items.append({
                "id": e["id"],
                "description": e.get("description", ""),
                "category": e.get("category", ""),
                "amount": amount,
                "at": e.get("date") or e.get("created_at"),
            })

    net = income_total - expense_total
    positive = max(0.0, net)
    daily_series = [
        {"date": d, "income": round(v["income"], 2), "expense": round(v["expense"], 2),
         "net": round(v["income"] - v["expense"], 2)}
        for d, v in sorted(daily.items())
    ]

    return {
        "start": start_label,
        "end": end_label,
        "income_total": round(income_total, 2),
        "expense_total": round(expense_total, 2),
        "net_profit": round(net, 2),
        "breakdown": {
            "salary_10": round(positive * 0.10, 2),
            "funds_20": round(positive * 0.20, 2),
            "reinvest_70": round(positive * 0.70, 2),
        },
        "daily": daily_series,
        "orders_count": len(income_orders),
        "expenses_count": len(expense_items),
        "income_orders": sorted(income_orders, key=lambda x: x["at"], reverse=True),
        "expense_items": sorted(expense_items, key=lambda x: x["at"] or "", reverse=True),
    }


@api_router.get("/")
async def root():
    return {"service": "Manino Coffee CRM API", "status": "ok"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
