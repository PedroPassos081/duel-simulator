"use client";

import { useEffect, useState, useMemo } from "react";
import { CircleDollarSign, Gem } from "lucide-react";
import type { Card } from "@/types/card";

interface ShopListing {
  id: string;
  cardId: number;
  card: Card;
  priceGold: number | null;
  priceCash: number | null;
  cashOnly: boolean;
  ownedQuantity: number;
  maxTotal?: number;
}

export default function ShopPage() {
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<ShopListing | null>(null);

  // Estados dos Filtros
  const [searchName, setSearchName] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "MONSTER" | "SPELL" | "TRAP">("ALL");
  const [attributeFilter, setAttributeFilter] = useState<string>("");
  const [monsterRaceFilter, setMonsterRaceFilter] = useState<string>("");
  const [subTypeFilter, setSubTypeFilter] = useState<string>("");

  async function loadListings() {
    const res = await fetch("/api/shop");
    if (res.ok) setListings(await res.json());
  }

  useEffect(() => {
    loadListings();
  }, []);

  useEffect(() => {
    if (selectedListing) {
      const updated = listings.find((l) => l.cardId === selectedListing.cardId);
      if (updated) setSelectedListing(updated);
    }
  }, [listings]);

  // Limpa subfiltros quando troca de categoria principal
  const handleCategoryChange = (cat: "ALL" | "MONSTER" | "SPELL" | "TRAP") => {
    setCategoryFilter(cat);
    setAttributeFilter("");
    setMonsterRaceFilter("");
    setSubTypeFilter("");
  };

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
      setMessage("Compra realizada com sucesso!");
      loadListings();
    } else {
      setMessage(data.error ?? "Erro na compra.");
    }
  }

  // Lógica de Filtragem
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      const card = item.card;
      const typeLower = card.type.toLowerCase();

      // 1. Pesquisa por Nome
      if (searchName.trim() !== "") {
        if (!card.name.toLowerCase().includes(searchName.toLowerCase())) {
          return false;
        }
      }

      // 2. Categoria Principal
      if (categoryFilter === "MONSTER") {
        if (!typeLower.includes("monster")) return false;
      } else if (categoryFilter === "SPELL") {
        if (!typeLower.includes("spell")) return false;
      } else if (categoryFilter === "TRAP") {
        if (!typeLower.includes("trap")) return false;
      }

      // 3. Filtros específicos para MONSTRO
      if (categoryFilter === "MONSTER") {
        if (attributeFilter && card.attribute?.toUpperCase() !== attributeFilter.toUpperCase()) {
          return false;
        }
        if (monsterRaceFilter && card.race?.toLowerCase() !== monsterRaceFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Filtros específicos para SPELL / TRAP
      if ((categoryFilter === "SPELL" || categoryFilter === "TRAP") && subTypeFilter) {
        if (card.race?.toLowerCase() !== subTypeFilter.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [listings, searchName, categoryFilter, attributeFilter, monsterRaceFilter, subTypeFilter]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Loja de Cartas</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Explore e adquira cópias para montar seu deck
          </p>
        </div>
        {message && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 text-sm text-amber-400 font-medium animate-fade-in">
            {message}
          </div>
        )}
      </div>

      {/* BARRA DE FILTROS */}
      <div className="flex flex-col gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 mb-8">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          
          {/* CAMPO DE PESQUISA POR NOME */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Pesquisar carta por nome (Inglês)..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            {searchName && (
              <button 
                onClick={() => setSearchName("")}
                className="absolute right-3 top-2.5 text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* BOTÕES DE CATEGORIA PRINCIPAL */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800 self-start md:self-auto">
            {(["ALL", "MONSTER", "SPELL", "TRAP"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  categoryFilter === cat
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {cat === "ALL" && "Todas"}
                {cat === "MONSTER" && "Monstros"}
                {cat === "SPELL" && "Spells"}
                {cat === "TRAP" && "Traps"}
              </button>
            ))}
          </div>
        </div>

        {/* SUBFILTROS DINÂMICOS */}
        {categoryFilter === "MONSTER" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Atributo:</span>
              <select
                value={attributeFilter}
                onChange={(e) => setAttributeFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos</option>
                <option value="LIGHT">LIGHT</option>
                <option value="DARK">DARK</option>
                <option value="WATER">WATER</option>
                <option value="FIRE">FIRE</option>
                <option value="EARTH">EARTH</option>
                <option value="WIND">WIND</option>
                <option value="DIVINE">DIVINE</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Tipo:</span>
              <select
                value={monsterRaceFilter}
                onChange={(e) => setMonsterRaceFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos os Tipos</option>
                <option value="Dragon">Dragon</option>
                <option value="Spellcaster">Spellcaster</option>
                <option value="Warrior">Warrior</option>
                <option value="Fiend">Fiend</option>
                <option value="Zombie">Zombie</option>
                <option value="Machine">Machine</option>
                <option value="Aqua">Aqua</option>
                <option value="Pyro">Pyro</option>
                <option value="Rock">Rock</option>
                <option value="Winged Beast">Winged Beast</option>
                <option value="Beast">Beast</option>
                <option value="Fairy">Fairy</option>
              </select>
            </div>
          </div>
        )}

        {categoryFilter === "SPELL" && (
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 animate-fade-in">
            <span className="text-xs text-zinc-400 font-medium">Tipo de Mágica:</span>
            <select
              value={subTypeFilter}
              onChange={(e) => setSubTypeFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              <option value="">Todas</option>
              <option value="Normal">Normal</option>
              <option value="Quick-Play">Quick-Play (Rápida)</option>
              <option value="Continuous">Continuous (Contínua)</option>
              <option value="Equip">Equip (Equipamento)</option>
              <option value="Field">Field (Campo)</option>
              <option value="Ritual">Ritual</option>
            </select>
          </div>
        )}

        {categoryFilter === "TRAP" && (
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 animate-fade-in">
            <span className="text-xs text-zinc-400 font-medium">Tipo de Armadilha:</span>
            <select
              value={subTypeFilter}
              onChange={(e) => setSubTypeFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              <option value="">Todas</option>
              <option value="Normal">Normal</option>
              <option value="Continuous">Continuous (Contínua)</option>
              <option value="Counter">Counter (Resposta)</option>
            </select>
          </div>
        )}
      </div>

      {/* COUNTER DE RESULTADOS */}
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-4 px-1">
        <span>Exibindo <strong>{filteredListings.length}</strong> cartas</span>
      </div>

      {/* GRID DE CARTAS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filteredListings.map((listing) => {
          const maxAllowed = listing.maxTotal ?? 3;
          const maxed = listing.ownedQuantity >= maxAllowed;

          return (
            <div
              key={listing.id}
              className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 transition-all duration-200 hover:border-amber-500/50 hover:bg-zinc-900 shadow-sm"
            >
              <div 
                className="cursor-pointer"
                onClick={() => setSelectedListing(listing)}
              >
                <div className="relative aspect-[1/1.45] w-full overflow-hidden rounded-lg flex items-center justify-center">
                  {listing.card.imageUrl ? (
                    <img
                      src={listing.card.imageUrl}
                      alt={listing.card.name}
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800/50 rounded-lg flex flex-col items-center justify-center text-center p-3 text-xs text-zinc-500 border border-zinc-800">
                      <span className="font-medium">Card Art</span>
                      <span className="text-[10px] opacity-50 mt-0.5">Indisponível</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 mt-3">
                  <h3 
                    className="font-semibold text-sm text-zinc-200 truncate leading-snug group-hover:text-amber-400 transition-colors" 
                    title={listing.card.name}
                  >
                    {listing.card.name}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Possui:</span>
                    <span className={`font-medium ${maxed ? 'text-amber-500' : 'text-zinc-300'}`}>
                      {listing.ownedQuantity} / {maxAllowed}
                    </span>
                  </div>
                </div>
              </div>

              {/* BOTÕES DE COMPRA NA GRID */}
              <div className="flex flex-col gap-2 mt-3 pt-2 border-t border-zinc-800/60">
                <div className="grid grid-cols-2 gap-1.5">
                  {listing.priceGold != null && (
                    <button
                      disabled={maxed || loadingId === `${listing.cardId}-gold`}
                      onClick={() => handleBuy(listing.cardId, "gold")}
                      className="group/btn rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold py-2 px-1 hover:bg-amber-500 hover:text-black disabled:bg-zinc-800/30 disabled:text-zinc-600 transition-all text-center flex items-center justify-center gap-1 min-h-[32px]"
                    >
                      {loadingId === `${listing.cardId}-gold` ? (
                        "..."
                      ) : (
                        <>
                          <CircleDollarSign className="w-3.5 h-3.5 text-amber-400 group-hover/btn:text-black transition-colors" />
                          <span>{listing.priceGold}</span>
                        </>
                      )}
                    </button>
                  )}
                  {/* BOTÃO GEM (ROXO) */}
                  {listing.priceCash != null && (
                    <button
                      disabled={maxed || loadingId === `${listing.cardId}-cash`}
                      onClick={() => handleBuy(listing.cardId, "cash")}
                      className="group/btn rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold py-2 px-1 hover:bg-purple-500 hover:text-white disabled:bg-zinc-800/30 disabled:text-zinc-600 transition-all text-center flex items-center justify-center gap-1 min-h-[32px]"
                    >
                      {loadingId === `${listing.cardId}-cash` ? (
                        "..."
                      ) : (
                        <>
                          <Gem className="w-3.5 h-3.5 text-purple-400 group-hover/btn:text-white transition-colors" />
                          <span>{listing.priceCash}</span>
                        </>
                      )}
                    </button>
                  )}
          
                </div>

                {maxed && (
                  <div className="text-center text-[10px] font-medium text-amber-500/80 bg-amber-500/10 py-1 rounded-md border border-amber-500/20">
                    Limite Alcançado
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE DETALHES */}
      {selectedListing && (() => {
        const card = selectedListing.card;
        const maxAllowed = selectedListing.maxTotal ?? 3;
        const maxed = selectedListing.ownedQuantity >= maxAllowed;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div 
              className="absolute inset-0" 
              onClick={() => setSelectedListing(null)} 
            />

            <div className="relative z-10 flex flex-col md:flex-row w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
              <button
                onClick={() => setSelectedListing(null)}
                className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
              >
                ✕
              </button>

              <div className="flex items-center justify-center bg-zinc-950/60 p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-zinc-800">
                <div className="relative aspect-[1/1.45] w-full max-w-[260px] overflow-hidden rounded-lg shadow-lg">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-sm">
                      Arte Indisponível
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-between p-6 md:w-1/2 gap-4 max-h-[80vh] overflow-y-auto">
                <div className="flex flex-col gap-3">
                  <h2 className="text-2xl font-bold text-zinc-100 leading-tight">
                    {card.name}
                  </h2>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-300 border border-zinc-700">
                      {card.type}
                    </span>
                    {card.attribute && (
                      <span className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1">
                        {card.attribute}
                      </span>
                    )}
                    {card.race && (
                      <span className="rounded-md bg-zinc-800/80 text-zinc-400 px-2 py-1">
                        [{card.race}]
                      </span>
                    )}
                    {card.level && (
                      <span className="rounded-md bg-amber-400/10 text-amber-300 px-2 py-1">
                        ★ Nível {card.level}
                      </span>
                    )}
                  </div>

                  {(card.atk != null || card.def != null) && (
                    <div className="flex items-center gap-4 text-xs font-bold text-zinc-300 bg-zinc-950/40 p-2 rounded-lg border border-zinc-800">
                      {card.atk != null && <span>ATK / {card.atk}</span>}
                      {card.def != null && <span>DEF / {card.def}</span>}
                    </div>
                  )}

                  <hr className="border-zinc-800" />

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Efeito / Descrição
                    </span>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line bg-zinc-950/30 p-3 rounded-lg border border-zinc-800/50 max-h-[180px] overflow-y-auto">
                      {card.description || "Esta carta não possui descrição de efeito."}
                    </p>
                  </div>
                </div>

                {/* BOTÕES DE COMPRA NO MODAL */}
                <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Na coleção:</span>
                    <span className={`font-bold ${maxed ? 'text-amber-500' : 'text-zinc-200'}`}>
                      {selectedListing.ownedQuantity} / {maxAllowed}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {selectedListing.priceGold != null && (
                      <button
                        disabled={maxed || loadingId === `${selectedListing.cardId}-gold`}
                        onClick={() => handleBuy(selectedListing.cardId, "gold")}
                        className="rounded-xl bg-amber-500 text-black text-xs font-bold py-3 px-2 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        {loadingId === `${selectedListing.cardId}-gold` ? (
                          "..."
                        ) : (
                          <>
                            <CircleDollarSign className="w-4 h-4 text-black" />
                            <span>Comprar ({selectedListing.priceGold})</span>
                          </>
                        )}
                      </button>
                    )}
                    {selectedListing.priceCash != null && (
                      <button
                        disabled={maxed || loadingId === `${selectedListing.cardId}-cash`}
                        onClick={() => handleBuy(selectedListing.cardId, "cash")}
                        className="rounded-xl bg-purple-600 text-white text-xs font-bold py-3 px-2 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        {loadingId === `${selectedListing.cardId}-cash` ? (
                          "..."
                        ) : (
                          <>
                            <Gem className="w-4 h-4 text-white" />
                            <span>Comprar ({selectedListing.priceCash})</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {maxed && (
                    <div className="text-center text-xs font-medium text-amber-500 bg-amber-500/10 py-1.5 rounded-lg border border-amber-500/20">
                      Você já possui o limite máximo dessa carta.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}