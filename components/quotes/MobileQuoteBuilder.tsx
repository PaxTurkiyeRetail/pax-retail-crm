'use client';
// Backward compatibility re-export
// Mobile/new-quote sayfası — hero gösterilir
import QuoteBuilder from './QuoteBuilder';
export default function MobileQuoteBuilder() {
  return <QuoteBuilder showHero />;
}
