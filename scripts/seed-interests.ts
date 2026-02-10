import { db } from "../src/db"
import { interestCategory, interest } from "../src/db/schema"
import { createId } from "@paralleldrive/cuid2"

type SeedInterest = {
  name: string
  popular?: boolean
}

type SeedCategory = {
  name: string
  slug: string
  displayOrder: number
  interests: SeedInterest[]
}

const CATEGORIES: SeedCategory[] = [
  {
    name: "Sports & Fitness",
    slug: "sports-fitness",
    displayOrder: 0,
    interests: [
      { name: "Basketball", popular: true },
      { name: "Football" },
      { name: "Running", popular: true },
      { name: "Yoga", popular: true },
      { name: "Swimming" },
      { name: "Tennis" },
      { name: "Cycling" },
      { name: "Hiking" },
      { name: "CrossFit" },
      { name: "Martial Arts" },
    ],
  },
  {
    name: "Technology",
    slug: "technology",
    displayOrder: 1,
    interests: [
      { name: "Web Development", popular: true },
      { name: "Mobile Apps" },
      { name: "AI & Machine Learning", popular: true },
      { name: "Data Science" },
      { name: "Cybersecurity" },
      { name: "Cloud Computing" },
      { name: "Game Dev" },
    ],
  },
  {
    name: "Arts & Culture",
    slug: "arts-culture",
    displayOrder: 2,
    interests: [
      { name: "Photography", popular: true },
      { name: "Music", popular: true },
      { name: "Painting" },
      { name: "Theater" },
      { name: "Film" },
      { name: "Writing" },
      { name: "Dance" },
      { name: "Pottery" },
    ],
  },
  {
    name: "Education & Learning",
    slug: "education-learning",
    displayOrder: 3,
    interests: [
      { name: "Language Exchange", popular: true },
      { name: "Book Club", popular: true },
      { name: "Study Group" },
      { name: "Tutoring" },
      { name: "Workshops" },
      { name: "Public Speaking" },
    ],
  },
  {
    name: "Business & Networking",
    slug: "business-networking",
    displayOrder: 4,
    interests: [
      { name: "Entrepreneurship", popular: true },
      { name: "Startups", popular: true },
      { name: "Freelancing" },
      { name: "Marketing" },
      { name: "Finance" },
      { name: "Career Development" },
    ],
  },
  {
    name: "Health & Wellness",
    slug: "health-wellness",
    displayOrder: 5,
    interests: [
      { name: "Meditation", popular: true },
      { name: "Nutrition" },
      { name: "Mental Health" },
      { name: "Fitness Coaching", popular: true },
      { name: "Pilates" },
      { name: "Self-Care" },
    ],
  },
  {
    name: "Social & Community",
    slug: "social-community",
    displayOrder: 6,
    interests: [
      { name: "Volunteering", popular: true },
      { name: "Meetups", popular: true },
      { name: "Neighborhood" },
      { name: "Cultural Exchange" },
      { name: "Charity" },
      { name: "Mentorship" },
    ],
  },
  {
    name: "Outdoor & Adventure",
    slug: "outdoor-adventure",
    displayOrder: 7,
    interests: [
      { name: "Camping", popular: true },
      { name: "Rock Climbing", popular: true },
      { name: "Surfing" },
      { name: "Skiing" },
      { name: "Trail Running" },
      { name: "Kayaking" },
      { name: "Fishing" },
    ],
  },
  {
    name: "Food & Drink",
    slug: "food-drink",
    displayOrder: 8,
    interests: [
      { name: "Cooking", popular: true },
      { name: "Wine Tasting" },
      { name: "Coffee", popular: true },
      { name: "Baking" },
      { name: "Food Tours" },
      { name: "Vegan/Vegetarian" },
    ],
  },
  {
    name: "Gaming",
    slug: "gaming",
    displayOrder: 9,
    interests: [
      { name: "Board Games", popular: true },
      { name: "Video Games", popular: true },
      { name: "Tabletop RPG" },
      { name: "Card Games" },
      { name: "Esports" },
    ],
  },
  {
    name: "Religion & Spirituality",
    slug: "religion-spirituality",
    displayOrder: 10,
    interests: [
      { name: "Bible Study" },
      { name: "Meditation Groups", popular: true },
      { name: "Interfaith" },
      { name: "Prayer Groups" },
      { name: "Philosophy" },
    ],
  },
  {
    name: "Parenting & Family",
    slug: "parenting-family",
    displayOrder: 11,
    interests: [
      { name: "Playgroups", popular: true },
      { name: "Homeschooling" },
      { name: "New Parents" },
      { name: "Family Activities", popular: true },
      { name: "Teen Activities" },
    ],
  },
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

async function seed() {
  // Check if categories already exist
  const existing = await db.select().from(interestCategory).limit(1)
  if (existing.length > 0) {
    console.log("Interest categories already exist, skipping seed.")
    return
  }

  console.log("Seeding interest categories and interests...")

  for (const cat of CATEGORIES) {
    const catId = createId()

    await db.insert(interestCategory).values({
      id: catId,
      name: cat.name,
      slug: cat.slug,
      displayOrder: cat.displayOrder,
    })

    for (const i of cat.interests) {
      await db.insert(interest).values({
        id: createId(),
        categoryId: catId,
        name: i.name,
        slug: slugify(i.name),
        popular: i.popular ?? false,
      })
    }

    console.log(`  Seeded category: ${cat.name} (${cat.interests.length} interests)`)
  }

  const totalInterests = CATEGORIES.reduce((sum, c) => sum + c.interests.length, 0)
  console.log(`Done! Seeded ${CATEGORIES.length} categories with ${totalInterests} interests.`)
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
