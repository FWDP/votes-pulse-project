export default function SentimentContent() {
    return (
        <>
            <div className="demo-sentiment-kpis">
                <article>
                    <strong>26%</strong>
                    <span>Positive sentiment</span>
                </article>
                <article>
                    <strong>46%</strong>
                    <span>Neutral sentiment</span>
                </article>
                <article>
                    <strong>28%</strong>
                    <span>Negative sentiment</span>
                </article>
            </div>
            <section>
                <h3>Sentiment by topic</h3>

            </section>
            <div className="demo-two-col">
                <section>
                    <h3>Positive vs negative radar</h3>
                    <div className="demo-radar"><i /><i /><i /><span>Trust</span><span>Economy</span><span>Services</span><span>Leadership</span></div>
                </section>
                <section>
                    <h3>Sentiment drivers</h3>

                </section>
            </div>
        </>
    )
}