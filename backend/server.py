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

app = FastAPI(title="Manino Coffee CRM")
api_router = APIRouter(prefix="/api")

ClientType = Literal["Particular", "Empresa"]
OrderStatus = Literal["pendiente", "en_proceso", "entregado"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    client_id: str
    items: List[OrderItemIn]
    status: OrderStatus = "pendiente"
    notes: Optional[str] = ""


class Order(BaseModel):
    id: str
    client_id: str
    client_name: str
    items: List[OrderItem]
    total: float
    status: OrderStatus
    notes: Optional[str] = ""
    created_at: str
    delivered_at: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class ClientNoteIn(BaseModel):
    body: str


class ClientNote(BaseModel):
    id: str
    client_id: str
    body: str
    created_at: str


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


@app.on_event("startup")
async def _startup():
    await seed_default_categories()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


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
    order_doc = {
        "id": order_id, "client_id": payload.client_id, "client_name": client_doc["business_name"],
        "items": [i.model_dump() for i in enriched_items], "total": round(total, 2),
        "status": payload.status, "notes": payload.notes or "", "created_at": created,
        "delivered_at": created if payload.status == "entregado" else None,
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


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, PROJECTION)
    if not order:
        raise HTTPException(404, "Pedido no encontrado")
    for item in order.get("items", []):
        await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": item["quantity"]}})
    await db.orders.delete_one({"id": order_id})
    return {"ok": True}


# ---- Dashboard & Analytics ----
def _parse_iso(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


@api_router.get("/dashboard/stats")
async def dashboard_stats():
    now = datetime.now(timezone.utc)
    start_30 = now - timedelta(days=30)
    start_7 = now - timedelta(days=7)
    orders = await db.orders.find({}, PROJECTION).to_list(100000)
    clients_count = await db.clients.count_documents({})
    products = await db.products.find({}, PROJECTION).to_list(10000)
    total_sales = sum(o.get("total", 0) for o in orders)
    total_orders = len(orders)
    avg_ticket = (total_sales / total_orders) if total_orders else 0
    sales_30 = orders_30 = sales_7 = 0
    for o in orders:
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
        day = _parse_iso(o["created_at"]).date().isoformat()
        if day in trend_map:
            trend_map[day] += o.get("total", 0); order_count_map[day] += 1
    trend = [{"date": d, "sales": round(trend_map[d], 2), "orders": order_count_map[d]} for d in sorted(trend_map.keys())]
    by_client = defaultdict(lambda: {"client_id": "", "client_name": "", "total": 0, "orders": 0})
    for o in orders:
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
    status_counts = {"pendiente": 0, "en_proceso": 0, "entregado": 0}
    for o in orders:
        status_counts[o.get("status", "pendiente")] = status_counts.get(o.get("status", "pendiente"), 0) + 1
    return {
        "kpis": {"total_sales": round(total_sales, 2), "total_orders": total_orders, "avg_ticket": round(avg_ticket, 2),
                 "total_clients": clients_count, "total_products": len(products),
                 "sales_30d": round(sales_30, 2), "orders_30d": orders_30, "sales_7d": round(sales_7, 2)},
        "trend_14d": trend, "top_clients": top_clients, "top_products": top_products,
        "low_stock": low_stock, "status_counts": status_counts,
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
