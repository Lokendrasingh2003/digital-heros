
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Search, ArrowUpRight } from "lucide-react";
import { API_URL } from "../api";
import SiteNav, { SiteFooter } from "../components/SiteNav";

export default function Charities() {
  const [charities, setCharities] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCharities() {
      try {
        const response = await fetch(`${API_URL}/charities`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Failed to load charities.");
        }

        setCharities(result.charities || []);
      } catch (err) {
        setError(err.message || "Unable to connect to the server.");
      } finally {
        setLoading(false);
      }
    }

    loadCharities();
  }, []);

  const categories = [
    "All",
    ...new Set(charities.map((charity) => charity.category).filter(Boolean)),
  ];

  const filteredCharities = charities.filter((charity) => {
    const matchesSearch = [
      charity.name,
      charity.description,
      charity.category,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      category === "All" || charity.category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <>
    <SiteNav />
    <main className="charities-page">
      <section className="charities-header">
        <span className="eyebrow">
          <Heart size={16} /> PLAY WITH PURPOSE
        </span>

        <h1>Every contribution can make a difference.</h1>

        <p>
          Discover causes you care about and support the charities making
          a positive impact.
        </p>
      </section>

      <section className="charities-directory">
        <div className="charities-toolbar">
          <label className="charity-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search charities or causes..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            aria-label="Filter charities by category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "All" ? "All categories" : item}
              </option>
            ))}
          </select>
        </div>

        {loading && <p>Loading charities...</p>}

        {error && <p role="alert">{error}</p>}

        {!loading && !error && filteredCharities.length === 0 && (
          <p>No charities found. Try another search.</p>
        )}

        <div className="charities-grid">
          {filteredCharities.map((charity) => (
            <article className="charity-card" key={charity.id}>
              {charity.image_url ? (
                <img
                  className="charity-image"
                  src={charity.image_url}
                  alt={charity.name}
                />
              ) : (
                <div className="charity-image charity-image-placeholder">
                  <Heart size={36} />
                </div>
              )}

              <div className="charity-card-content">
                {charity.is_featured && (
                  <span className="featured-label">Featured charity</span>
                )}

                {charity.category && (
                  <span className="charity-category">
                    {charity.category}
                  </span>
                )}

                <h2>{charity.name}</h2>
                <p>
                  {charity.description || "Learn more about this cause."}
                </p>

                <div className="charity-card-actions">
                  {charity.website_url && (
                    <a
                      href={charity.website_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit website <ArrowUpRight size={16} />
                    </a>
                  )}

                  <Link to={`/charities/${charity.id}`}>
                    View profile <Heart size={16} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
    <SiteFooter />
    </>
  );
}
