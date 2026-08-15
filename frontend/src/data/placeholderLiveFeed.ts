import type { LiveFeedItem } from "../types/liveFeed";

export const placeholderLiveFeed: LiveFeedItem[] = [
    {
        id: "feed-001",
        location: "Roxas",
        category: "Agriculture & Livelihood",
        text: "Panahon na para suportahan ang aming mga magsasaka rito sa Roxas",
        sentiment: "negative",
        source: "Facebook",
        publishedAt: new Date().toISOString(),
        isNew: true,
    },

    {
        id: "feed-002",
        location: "Mamburao",
        category: "Education",
        text: "Salamat sa bagong classroom sa Mamburao Central! Malaking tulong",
        sentiment: "positive",
        source: "Facebook",
        publishedAt: new Date().toISOString(),
        isNew: false,
    },

    {
        id: "feed-003",
        location: "Naujan",
        category: "Health Services",
        text: "Wala pa ring doktor sa health center namin — October pa huling pumunta",
        sentiment: "negative",
        source: "Facebook",
        publishedAt: new Date().toISOString(),
        isNew: false,
    },

    {
        id: "feed-004",
        location: "San Jose",
        category: "Agriculture & Livelihood",
        text: "Ang baba ng presyo ng palay ngayon, wala kaming kinukuha",
        sentiment: "negative",
        source: "Facebook",
        publishedAt: new Date().toISOString(),
        isNew: false,
    },

    {
        id: "feed-005",
        location: "Pinamalayan",
        category: "Flooding & Disaster Risk",
        text: "Lagi na lang binabaha ang barangay namin tuwing umuulan",
        sentiment: "negative",
        source: "Facebook",
        publishedAt: new Date().toISOString(),
        isNew: false,
    },

    {
        id: "feed-006",
        location: "Puerto Galera",
        category: "Tourism Development",
        text: "Maganda ang bagong pier! Mas madali na ang biyahe ng mga turista",
        sentiment: "positive",
        source: "Facebook",
        publishedAt: new Date().toISOString(),
        isNew: false,
    },

    {
        id: "feed-007",
        location: "Calapan City",
        category: "Infrastructure & Roads",
        text: "Grabe ang daan sa Palayan Road, magbuwan na hindi naaayos",
        sentiment: "negative",
        source: "Facebook",
        publishedAt: new Date().toISOString(),
        isNew: false,
    },

    {
        id: "feed-008",
        location: "Baco",
        category: "Agriculture & Livelihood",
        text: "May seedling distribution na — pero kulang pa rin ang suporta",
        sentiment: "neutral",
        source: "Facebook",
        publishedAt: new Date().toISOString(),
        isNew: false,
    },
];