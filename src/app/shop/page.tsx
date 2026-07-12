"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/types/card";

interface ShopListing {
  id: string;
  cardId: number;
  card: Card;
  priceGold: number | null;
  priceCash: number | null;
  cashOnly: boolean;
  ownedQuantity: number;
}

export default function ShopPage() {
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function loadListings() {
    const res = await fetch("/api/shop");
    if (res.ok) setListings(await res.json());
  }

  useEffect(() => {
    loadListings();
  }, []);

  async function handleBuy(cardId: number, currency: "gold" | "cash") {
    setLoadingId(`${cardId}-${currency}`);
    setMessage(null);

    const res = await fetch("/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, currency }),
    });

    const data = await res.json();
    setLoadingId(null);

    if (res.ok) {
      setMessage("Compra realizada!");
      loadListings(); // atualiza saldo/posse
    } else {
      setMessage(data.error ?? "Erro na compra.");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Loja de Cartas</h1>
      {message && <p className="mb-4 text-sm text-amber-300">{message}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => {
          const maxed = listing.ownedQuantity >= 3;
          return (
            <div
              key={listing.id}
              className="rounded border border-edison-border bg-edison-panel p-3 text-sm"
            >
              <p className="font-medium">{listing.card.name}</p>
              <p className="mb-2 text-xs text-gray-400">
                Você possui: {listing.ownedQuantity}/3
              </p>

              <div className="flex flex-col gap-1">
                {listing.priceGold != null && (
                  <button
                    disabled={maxed || loadingId === `${listing.cardId}-gold`}
                    onClick={() => handleBuy(listing.cardId, "gold")}
                    className="rounded bg-edison-gold px-2 py-1 text-black hover:opacity-90 disabled:opacity-40"
                  >
                    Comprar por {listing.priceGold} gold
                  </button>
                )}
                {listing.priceCash != null && (
                  <button
                    disabled={maxed || loadingId === `${listing.cardId}-cash`}
                    onClick={() => handleBuy(listing.cardId, "cash")}
                    className="rounded bg-edison-cash px-2 py-1 text-black hover:opacity-90 disabled:opacity-40"
                  >
                    Comprar por {listing.priceCash} cash
                  </button>
                )}
                {listing.cashOnly && (
                  <span className="text-xs text-edison-cash">Exclusivo cash</span>
                )}
                {maxed && <span className="text-xs text-gray-500">Limite máximo atingido</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
