import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentRequestButtonElement, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import styles from './ShopSection.module.css';

// Zastąp swoim właściwym kluczem publicznym Stripe
const stripePromise = loadStripe('pk_test_TYooMQauvdEDq54NiTphI7jx');

const CheckoutForm = ({ planName, priceAmount, onPaymentSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canMakePayment, setCanMakePayment] = useState(false);
  const [checkedWallet, setCheckedWallet] = useState(false);

  useEffect(() => {
    if (stripe) {
      const pr = stripe.paymentRequest({
        country: 'PL',
        currency: 'pln',
        total: {
          label: `Abonament Premium: ${planName}`,
          amount: priceAmount,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      pr.canMakePayment().then((result) => {
        if (result) {
          setPaymentRequest(pr);
          setCanMakePayment(true);
        }
        setCheckedWallet(true);
      });
    }
  }, [stripe, planName, priceAmount]);

  if (!stripe || !checkedWallet) {
    return <div className={styles.loading}>Sprawdzanie dostępności portfeli...</div>;
  }

  return (
    <div className={styles.checkoutWrapper}>
      {canMakePayment ? (
        <PaymentRequestButtonElement 
          options={{ paymentRequest }} 
          className={styles.paymentButton}
        />
      ) : (
        <div className={styles.noPaymentMethod}>
          <p>Twoja przeglądarka nie obsługuje Apple/Google Pay lub nie masz tam podpiętej karty.</p>
          <div style={{ padding: '16px', background: 'white', borderRadius: '6px', margin: '16px 0', textAlign: 'left' }}>
            <CardElement options={{ style: { base: { fontSize: '16px', color: '#32325d' } } }} />
          </div>
          <button className={styles.fallbackButton} onClick={() => alert('W prawdziwej aplikacji w tym miejscu wysłałbym żądanie platności na backend!')}>
            Zapłać {(priceAmount / 100).toFixed(2)} PLN by aktywować
          </button>
        </div>
      )}
    </div>
  );
};

export default function ShopSection() {
  const [selectedPlan, setSelectedPlan] = useState(null);

  const plans = [
    { id: 'monthly', name: '1 Miesiąc', price: 500, priceLabel: '5.00 PLN' },
    { id: 'six_months', name: '6 Miesięcy', price: 2000, priceLabel: '20.00 PLN', badge: 'Popularne' },
    { id: 'yearly', name: '12 Miesięcy', price: 3500, priceLabel: '35.00 PLN', badge: 'Najlepsza Oferta' }
  ];

  return (
    <div className={styles.shopContainer}>
      <div className={styles.header}>
        <h2>Sklep Premium</h2>
        <p>Wykup abonament, aby odblokować dodatkowe możliwości w zarządzaniu flotą i zyskać bonusy!</p>
      </div>

      <div className={styles.plans}>
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`${styles.planCard} ${selectedPlan?.id === plan.id ? styles.selected : ''}`}
            onClick={() => setSelectedPlan(plan)}
          >
            {plan.badge && <span className={styles.badge}>{plan.badge}</span>}
            <h3>{plan.name}</h3>
            <div className={styles.price}>{plan.priceLabel}</div>
            <ul className={styles.features}>
              <li>✨ Brak reklam</li>
              <li>🚀 Szybsze naprawy taboru</li>
              <li>📊 Zaawansowane raporty finansowe</li>
              <li>💎 Unikalny złoty pociąg</li>
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.paymentSection}>
        {selectedPlan ? (
          <>
            <h3>Wybrano: {selectedPlan.name} ({selectedPlan.priceLabel})</h3>
            <Elements stripe={stripePromise}>
              <CheckoutForm 
                planName={selectedPlan.name} 
                priceAmount={selectedPlan.price} 
                onPaymentSuccess={() => alert('Dziękujemy za zakup!')} 
              />
            </Elements>
          </>
        ) : (
          <div className={styles.selectPrompt}>Wybierz plan powyżej, aby kontynuować</div>
        )}
      </div>
    </div>
  );
}
