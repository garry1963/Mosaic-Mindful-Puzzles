import { PuzzleConfig, Difficulty } from "./types";

// ----------------------------------------------------------------------
// KEYWORD COLLECTIONS (30 unique terms per category)
// ----------------------------------------------------------------------

// 1. Classic Cars
const CLASSIC_CARS_KEYS = "vintage car,classic mustang,classic corvette,ferrari 250 gto,porsche 911 classic,vw beetle vintage,vw camper van,hot rod car,shelby cobra,aston martin db5,jaguar e-type,mercedes 300sl,chevrolet bel air,cadillac eldorado,ford thunderbird,dodge charger classic,plymouth barracuda,pontiac gto,buick riviera,lincoln continental,old car dashboard,chrome bumper classic,whitewall tires,antique steering wheel,hood ornament vintage,classic car grill,leather car interior,spoked wheels car,retro speedometer,convertible classic";

// 2. Animals
const ANIMALS_KEYS = "lion portrait,tiger prowling,grizzly bear,african elephant,giraffe savanna,zebra stripes,chimpanzee,mountain wolf,red fox,fallow deer,bull moose,racoon close up,red squirrel,cotton tail rabbit,bald eagle flying,snowy owl,macaw parrot,emperor penguin,bottlenose dolphin,humpback whale,great white shark,sea turtle,tree frog,green python,chameleon,monarch butterfly,honey bee flower,wild horse running,highland cow,polar bear";

// 3. Disney Characters (Refined for Art/Illustration)
const DISNEY_KEYS = "mickey mouse illustration,minnie mouse cartoon,donald duck art,goofy character,pluto dog disney,cinderella princess,snow white art,ariel little mermaid,belle beauty beast,jasmine aladdin,rapunzel tangled,elsa frozen art,anna frozen art,moana disney,tiana princess frog,merida brave,tinkerbell fairy,peter pan flying,captain hook art,alice in wonderland,mad hatter art,winnie the pooh art,tigger character,stitch lilo art,woody toy story,buzz lightyear art,nemo clownfish,dory finding nemo,mike wazowski,lightning mcqueen";

// 4. Cats
const CATS_KEYS = "tabby cat face,siamese cat,persian cat fluffy,maine coon cat,black cat halloween,white cat blue eyes,orange tabby cat,calico cat,sleeping cat cozy,playful kitten,cat green eyes,cat paws macro,cat whiskers,funny cat face,grumpy cat,cat portrait studio,fluffy kitten,sphynx cat,bengal cat spots,ragdoll cat,british shorthair,scottish fold cat,siberian cat,burmese cat,russian blue cat,savannah cat,norwegian forest cat,cute kitten basket,cat stretching,ginger cat";

// 5. Historical Buildings
const HISTORICAL_KEYS = "neuschwanstein castle,buckingham palace,notre dame cathedral,ancient greek temple,egypt pyramids giza,roman colosseum,parthenon athens,taj mahal india,great wall china,eiffel tower paris,big ben london,statue of liberty,machu picchu peru,petra jordan treasury,angkor wat cambodia,acropolis athens,stonehenge uk,leaning tower pisa,hagia sophia istanbul,versailles palace,himeji castle japan,forbidden city beijing,kremlin moscow,st basils cathedral,pantheon rome,mount rushmore,golden gate bridge,brooklyn bridge historic,sydney opera house,petronas towers";

// 6. People
const PEOPLE_KEYS = "portrait young woman,portrait old man,happy child smiling,elderly woman smiling,diverse group people,fashion model outdoor,street photography portrait,candid laughter,musician playing guitar,artist painting canvas,ballet dancer,runner athlete,doctor portrait,chef cooking food,business woman city,student studying library,teacher classroom,mother holding baby,father and son,couple hugging sunset,friends selfie,backpacker traveler,hiker mountain top,yoga woman beach,meditation pose,woman reading book,drinking coffee cafe,man playing piano,girl holding flowers,man wearing hat";

// 7. Abstract
const ABSTRACT_KEYS = "abstract fluid art,fractal geometry,geometric pattern colorful,bokeh lights abstract,macro texture art,paint splash explosion,ink in water swirl,smoke swirls color,fire flame abstract,glitch art digital,low poly landscape,wireframe mesh,neon lights abstract,holographic texture,iridescent surface,liquid metal abstract,wood grain macro,marble texture,crystal macro,diamond refraction,glass prism rainbow,kaleidoscope pattern,mandala art,zen stone circles,minimalist abstract,gradient color background,vaporwave aesthetic,synthwave grid,acrylic pour painting,oil paint texture";

// 8. Nature
const NATURE_KEYS = "mountain peak snow,forest path sunlight,waterfall jungle,lake reflection mountain,sunset beach tropical,desert sand dunes,snowy mountain range,autumn forest road,spring meadow flowers,sunflower field,tropical island aerial,grand canyon,river stream stones,thunderstorm lightning,double rainbow,starry night sky,northern lights aurora,volcano eruption,coral reef fish,rainforest jungle,bamboo forest japan,limestone cave,glacier ice,cliff ocean view,wheat field golden,cherry blossom tree,palm tree sunset,saguaro cactus sunset,mossy rock river,ocean wave crashing";

// 9. Urban
const URBAN_KEYS = "city skyline night,skyscraper low angle,street lights rain,neon sign city,busy intersection tokyo,subway station empty,graffiti street art,bridge at night,yellow taxi cab,bus stop rain,rooftop city view,narrow alleyway,brick wall texture,concrete architecture,glass building reflection,urban park bench,street food stall,traffic light trails,bicycle city street,vespa scooter,pedestrian crossing,rainy city street,vintage lamppost,fire escape stairs,storefront window,market stall fruit,construction crane,train tracks urban,harbor crane,city skyline day";

// 10. Spring
const SPRING_KEYS = "spring tulips,daffodils yellow,cherry blossom branch,green grass dew,baby lamb,easter eggs basket,monarch butterfly flower,rain boots puddle,spring rainbow,seedling sprout,garden blooming,blooming apple tree,bird nest eggs,robin singing,honey bee blossom,ladybug leaf,picnic basket grass,kite flying blue sky,colorful umbrella rain,morning dew drops,sunbeam forest,fresh strawberries,vegetable garden spring,watering can vintage,wheelbarrow flowers,white picket fence,park bench spring,bicycle flower basket,spring cleaning,crocus flower";

// 11. Summer
const SUMMER_KEYS = "summer beach umbrella,ice cream cone,sunglasses beach,swimming pool blue,palm tree coconut,sand castle beach,surfboard ocean,beach ball sand,flip flops sand,sun hat straw,lemonade pitcher,bbq grill party,camping tent forest,campfire night,fireworks display,watermelon slice,pineapple fruit,coconut drink,cocktail umbrella,sailboat ocean,jetski water,lifeguard tower,seagull flying,seashells sand,starfish beach,crab beach,jellyfish underwater,sunflower close up,picnic blanket park,convertible car road trip";

// 12. Autumn
const AUTUMN_KEYS = "autumn leaves red,pumpkin patch,halloween pumpkin,thanksgiving table,acorn oak leaf,pinecone macro,mushroom forest,foggy forest autumn,rainy window autumn,umbrella leaves,rain boots mud,knitted scarf,cozy sweater,fireplace wood,hot chocolate mug,apple pie fresh,corn field harvest,scarecrow field,hay bale farm,tractor harvest,red barn autumn,harvest basket,orange maple tree,yellow aspen tree,fallen leaves path,park bench autumn,squirrel holding nut,owl in tree,full moon halloween,cinnamon sticks";

// 13. Winter
const WINTER_KEYS = "winter snow landscape,snowflake macro,snowman scarf,icicles roof,frozen lake skating,skier mountain,snowboarder jump,sledding hill,fireplace cozy,hot cocoa marshmallows,christmas tree lights,gift box ribbon,reindeer snow,santa claus art,christmas ornament,holiday wreath,string lights bokeh,candle light,knitted sweater texture,wool mittens,winter scarf,beanie hat,winter cabin snow,pine tree snow,cardinal bird snow,polar bear snow,penguin ice,husky dog snow,aurora borealis winter,frosted window";

// 14. Indoor
const INDOOR_KEYS = "cozy living room fireplace,modern kitchen white,luxury bedroom hotel,home library books,reading nook window,coffee shop interior,restaurant table setting,hotel lobby luxury,hallway architecture,spiral staircase,window view city,velvet sofa,leather armchair,dining table set,crystal chandelier,bookshelf full,house plant monstera,desk setup computer,gaming room neon,loft apartment,studio apartment,fireplace mantle,bathroom spa tub,walk in closet,wine cellar bottles,attic room,sunroom plants,conservatory glass,garage workshop,basement man cave";

// 15. Fine Art & Masterpieces (Specific Artworks)
const FINE_ART_KEYS = "starry night van gogh painting,mona lisa da vinci painting,the scream munch painting,girl with a pearl earring painting,birth of venus botticelli painting,great wave hokusai print,the kiss gustav klimt painting,persistence of memory dali painting,last supper da vinci painting,creation of adam michelangelo fresco,night watch rembrandt painting,school of athens raphael fresco,guernica picasso painting,american gothic grant wood painting,son of man magritte painting,wanderer above the sea of fog painting,garden of earthly delights bosch painting,liberty leading the people painting,raft of the medusa painting,water lilies monet painting,sunflowers van gogh painting,cafe terrace at night van gogh,composition 8 kandinsky,yellow red blue kandinsky,convergence jackson pollock,shot marilyn warhol,campbell soup cans warhol,swans reflecting elephants dali,treachery of images magritte,frida kahlo self portrait";

// 16. Icons & Logos (Brand/Symbol specific)
const ICONS_KEYS = "apple inc logo,nike swoosh logo,coca cola trademark,pepsi logo brand,mcdonalds golden arches,starbucks coffee logo,mercedes benz emblem,ferrari prancing horse logo,batman bat symbol,superman s shield,mickey mouse silhouette icon,nasa insignia,google g logo,amazon smile logo,lego red logo,playstation symbols,xbox logo sphere,nintendo mario face icon,spotify green icon,instagram camera logo,youtube play button logo,twitter bird icon blue,facebook f logo,android robot icon,windows os logo,intel inside logo,ibm blue logo,general electric logo,shell oil pecten,target store bullseye";

// 17. Movies & TV Shows (Specific Scenes/Characters)
const MOVIES_KEYS = "star wars darth vader scene,harry potter hogwarts movie,lord of the rings gandalf scene,iron man marvel movie,batman dark knight movie,joker movie scene,spiderman movie action,jurassic park t-rex scene,lion king simba movie,frozen elsa disney movie,toy story buzz woody,shrek movie scene,pirates caribbean jack sparrow,matrix neo bullet time,avatar movie pandora,titanic movie ship bow,godfather movie scene,pulp fiction movie scene,fight club movie scene,forrest gump bench scene,gladiator russell crowe scene,stranger things tv show,game of thrones dragon scene,breaking bad heisenberg tv,friends tv show central perk,simpsons cartoon family,mandalorian baby yoda scene,james bond 007 movie,indiana jones movie scene,back to the future delorean";

// 18. Album Covers (Specific Albums)
const ALBUMS_KEYS = "pink floyd dark side moon album,beatles abbey road album cover,nirvana nevermind album cover,david bowie aladdin sane album,queen bohemian rhapsody album,rolling stones sticky fingers album,led zeppelin i album cover,michael jackson thriller album,prince purple rain album,madonna true blue album,elvis presley debut album,bob marley legend album,jimi hendrix are you experienced,daft punk random access memories,gorillaz demon days album,adele 21 album cover,taylor swift 1989 album,beyonce lemonade album,drake scorpion album cover,kanye west graduation album,eminem the eminem show album,tupac all eyez on me album,metallica master of puppets album,acdc back in black album,guns n roses appetite for destruction,iron maiden number of the beast,coldplay parachutes album,radiohead ok computer album,u2 joshua tree album,fleetwood mac rumours album";

// 19. Abstract & Colour Gradients (Textures/Colors)
const GRADIENTS_KEYS = "abstract rainbow gradient,holographic foil texture,neon gradient background,pastel gradient wallpaper,sunset color palette abstract,aurora borealis abstract,fluid acrylic paint swirl,ink in water macro abstract,kaleidoscope pattern colorful,prism light refraction abstract,stained glass texture abstract,mosaic tile pattern colorful,pixel art gradient abstract,glitch art texture abstract,vaporwave aesthetic gradient,synthwave sunset grid,cyberpunk neon city abstract,bokeh colorful lights abstract,macro oil and water abstract,iridescent pearl texture,fractal gradient art,geometric color pattern abstract,polygonal art gradient,abstract fluid art vibrant,vibrant color swirl abstract,chromatic aberration abstract,heat map gradient abstract,color spectrum wheel abstract,paint splash close up abstract,liquid metal gradient abstract";

// ----------------------------------------------------------------------
// GENERATOR FUNCTION
// ----------------------------------------------------------------------

const generateCategoryPuzzles = (
  category: string, 
  keywordsString: string, 
  count: number, 
  startLockId: number
): PuzzleConfig[] => {
  const difficulties: Difficulty[] = ['easy', 'normal', 'hard', 'expert'];
  const keywords = keywordsString.split(',').map(s => s.trim());
  
  return Array.from({ length: count }, (_, i) => {
    // Deterministic difficulty based on index
    const difficulty = difficulties[i % 4];
    
    // Rotate through keywords. We expect exactly 30 unique keywords per category.
    // If fewer are provided, we loop, but uniqueness depends on the lock.
    // The lists above provide 30 unique terms to ensure 30 unique images.
    const keyword = keywords[i % keywords.length];
    
    // Capitalize for title (clean up extra descriptors for display)
    // E.g. "starry night van gogh painting" -> "Starry Night Van Gogh" (simplified logic)
    const title = keyword.split(' ').slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // STRICTER URL GENERATION:
    // 1. Replace spaces with commas
    // 2. Append '/all' to LoremFlickr URL to enforce "Match ALL keywords"
    // 3. Use v4 ID to bust cache and force fresh load.
    const urlKeyword = keyword.replace(/\s+/g, ',');

    return {
      id: `${category.toLowerCase().replace(/\s+/g, '-')}-v4-${i + 1}`,
      title: title,
      // The '/all' suffix ensures relevance by requiring all tags to match.
      src: `https://loremflickr.com/800/800/${urlKeyword}/all?lock=${startLockId + i}`,
      difficulty,
      category
    };
  });
};

// ----------------------------------------------------------------------
// COLLECTIONS
// ----------------------------------------------------------------------

// Shifted lock IDs by 50000 to ensure fresh images for v4
const CLASSIC_CARS = generateCategoryPuzzles('Classic Cars', CLASSIC_CARS_KEYS, 30, 51000);
const ANIMALS = generateCategoryPuzzles('Animals', ANIMALS_KEYS, 30, 52000);
const DISNEY = generateCategoryPuzzles('Disney Characters', DISNEY_KEYS, 30, 53000);
const CATS = generateCategoryPuzzles('Cats', CATS_KEYS, 30, 54000);
const HISTORICAL = generateCategoryPuzzles('Historical Buildings', HISTORICAL_KEYS, 30, 55000);
const PEOPLE = generateCategoryPuzzles('People', PEOPLE_KEYS, 30, 56000);
const ABSTRACT = generateCategoryPuzzles('Abstract', ABSTRACT_KEYS, 30, 57000);

const NATURE = generateCategoryPuzzles('Nature', NATURE_KEYS, 30, 58000);
const URBAN = generateCategoryPuzzles('Urban', URBAN_KEYS, 30, 59000);
const SPRING = generateCategoryPuzzles('Spring', SPRING_KEYS, 30, 60000);
const SUMMER = generateCategoryPuzzles('Summer', SUMMER_KEYS, 30, 61000);
const AUTUMN = generateCategoryPuzzles('Autumn', AUTUMN_KEYS, 30, 62000);
const WINTER = generateCategoryPuzzles('Winter', WINTER_KEYS, 30, 63000);
const INDOOR = generateCategoryPuzzles('Indoor', INDOOR_KEYS, 30, 64000);

const FINE_ART = generateCategoryPuzzles('Fine Art & Masterpieces', FINE_ART_KEYS, 30, 65000);
const ICONS = generateCategoryPuzzles('Icons & Logos', ICONS_KEYS, 30, 66000);
const MOVIES = generateCategoryPuzzles('Movies & TV Shows', MOVIES_KEYS, 30, 67000);
const ALBUMS = generateCategoryPuzzles('Album Covers', ALBUMS_KEYS, 30, 68000);
const GRADIENTS = generateCategoryPuzzles('Abstract & Colour Gradients', GRADIENTS_KEYS, 30, 69000);

export const INITIAL_PUZZLES: PuzzleConfig[] = [
  ...CLASSIC_CARS,
  ...ANIMALS,
  ...CATS,
  ...DISNEY,
  ...HISTORICAL,
  ...PEOPLE,
  ...ABSTRACT,
  ...NATURE,
  ...URBAN,
  ...SPRING,
  ...SUMMER,
  ...AUTUMN,
  ...WINTER,
  ...INDOOR,
  ...FINE_ART,
  ...ICONS,
  ...MOVIES,
  ...ALBUMS,
  ...GRADIENTS
];

export const DIFFICULTY_SETTINGS = {
  easy: { rows: 3, cols: 3, snapThreshold: 5, rotate: false, hints: 5 },
  normal: { rows: 5, cols: 5, snapThreshold: 4, rotate: false, hints: 3 },
  hard: { rows: 7, cols: 7, snapThreshold: 3, rotate: true, hints: 1 },
  expert: { rows: 10, cols: 10, snapThreshold: 2, rotate: true, hints: 0 },
};