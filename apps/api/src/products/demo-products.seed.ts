import { EntityManager } from 'typeorm';
import { Product } from './product.entity';

export interface DemoProduct {
  id: string;
  name: string;
  basePrice: number;
  stock: number;
  imageUrl: string;
}

/**
 * External product-photo source and attribution are kept beside each URL.
 * The four existing menu prices/stock values follow the supplied reference;
 * prices and stocks for the five additions are demo values, not official.
 */
export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Cà phê Muối',
    basePrice: 40000,
    stock: 50,
    // Photo: Luke Digweed, Vietnam Coracle, https://www.vietnamcoracle.com/salt-coffee-ca-phe-muoi/.
    imageUrl:
      'https://cms.vietnamcoracle.com/wp-content/uploads/2023/08/VC-Cofee-draft-3-title-final-scaled.jpg',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Cà phê sữa đá',
    basePrice: 35000,
    stock: 100,
    // Photo: Tu Ngoc Minh, Unsplash, https://unsplash.com/photos/a-glass-with-a-drink-in-it-blQLC6CT36Q.
    imageUrl:
      'https://images.unsplash.com/photo-1664515725366-e8328e9dc834?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Matcha Latte',
    basePrice: 45000,
    stock: 50,
    // Photo: Jason Leung, Unsplash, https://unsplash.com/fr/photos/tasse-a-the-en-ceramique-blanche-remplie-de-the-matcha-Z-hvocTfR_s.
    imageUrl:
      'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Trà Tắc',
    basePrice: 25000,
    stock: 100,
    // Photo source: Znews.vn, https://znews.vn/chieu-den-tu-tap-via-he-nham-mon-ngon-dep-re-post410519.html (individual photographer not credited on the source page).
    imageUrl:
      'https://photo.znews.vn/w660/Uploaded/rotntt/2014_04_22/3quanviaheconhieumon_1.jpg',
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    name: 'Cappuccino',
    basePrice: 45000,
    stock: 50,
    // Photo: nameless 3791, Unsplash, https://unsplash.com/photos/a-cappuccino-on-a-saucer-on-a-wooden-table-QHcXb0-fYfA.
    imageUrl:
      'https://images.unsplash.com/photo-1732542347785-f9d6d53df15e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    name: 'Americano đá',
    basePrice: 30000,
    stock: 100,
    // Photo: Unsplash iced-Americano collection, https://unsplash.com/s/photos/iced-americano (photographer was not surfaced for this image result).
    imageUrl:
      'https://images.unsplash.com/photo-1681026859292-58c3b2041bfd?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '00000000-0000-4000-8000-000000000007',
    name: 'Cacao sữa đá',
    basePrice: 35000,
    stock: 50,
    // Photo: You Le, Unsplash, https://unsplash.com/photos/iced-chocolate-drink-with-a-straw-and-small-christmas-tree-XeC52osZdmQ.
    imageUrl:
      'https://images.unsplash.com/photo-1768634003070-037e1b416c8a?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '00000000-0000-4000-8000-000000000008',
    name: 'Cold Brew',
    basePrice: 40000,
    stock: 50,
    // Photo: Mayur, Unsplash, https://unsplash.com/photos/clear-drinking-glass-with-brown-liquid-vP9TjdIm9fE.
    imageUrl:
      'https://images.unsplash.com/photo-1581996323441-538096e854b9?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '00000000-0000-4000-8000-000000000009',
    name: 'Trà đào',
    basePrice: 35000,
    stock: 100,
    // Photo source: ArtfulTea, https://artfultea.com/products/ginger-peach-black-tea (individual photographer not credited on the source page).
    imageUrl:
      'https://artfultea.com/cdn/shop/files/0-1_2f43135a-b317-47d8-8f56-5e79f8a4265f.jpg?v=1763234911&width=1346',
  },
];

export interface DemoSeedResult {
  inserted: string[];
  alreadyPresent: string[];
  conflicts: Array<{ name: string; existingId: string }>;
}

/** Insert missing demo products without changing or deleting existing rows. */
export async function seedDemoProducts(
  manager: EntityManager,
): Promise<DemoSeedResult> {
  const result: DemoSeedResult = {
    inserted: [],
    alreadyPresent: [],
    conflicts: [],
  };

  for (const demoProduct of DEMO_PRODUCTS) {
    const matchingId = await manager.findOneBy(Product, {
      id: demoProduct.id,
    });
    if (matchingId) {
      if (matchingId.name === demoProduct.name) {
        result.alreadyPresent.push(demoProduct.name);
      } else {
        result.conflicts.push({
          name: demoProduct.name,
          existingId: matchingId.id,
        });
      }
      continue;
    }

    const nameMatches = (await manager.query(
      'SELECT id, name FROM product WHERE lower(btrim(name)) = lower(btrim($1)) LIMIT 1',
      [demoProduct.name],
    )) as Array<{ id: string; name: string }>;
    if (nameMatches.length > 0) {
      result.conflicts.push({
        name: demoProduct.name,
        existingId: nameMatches[0].id,
      });
      continue;
    }

    await manager.insert(Product, demoProduct);
    result.inserted.push(demoProduct.name);
  }

  return result;
}
