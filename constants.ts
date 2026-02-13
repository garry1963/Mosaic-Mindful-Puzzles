import { PuzzleConfig, Difficulty } from "./types";

// ----------------------------------------------------------------------
// KEYWORD COLLECTIONS (30 unique terms per category for variety)
// ----------------------------------------------------------------------

const CLASSIC_CARS_KEYS = "vintage car,classic car,muscle car,sports car,antique car,retro dashboard,chrome bumper,headlight,convertible,mustang,corvette,ferrari classic,porsche classic,vw beetle,camper van,hot rod,sedan,coupe,roadster,luxury car,steering wheel,engine,rims,hood ornament,tail light,grille,leather seat,speedometer,car show,rust car";

const ANIMALS_KEYS = "lion,tiger,bear,elephant,giraffe,zebra,monkey,gorilla,wolf,fox,deer,moose,racoon,squirrel,rabbit,eagle,owl,parrot,penguin,dolphin,whale,shark,turtle,frog,snake,lizard,butterfly,bee,horse,cow";

const DISNEY_KEYS = "mickey mouse,minnie mouse,donald duck,goofy,pluto,cinderella,snow white,ariel mermaid,belle beauty beast,jasmine aladdin,rapunzel tangled,elsa frozen,anna frozen,moana,tiana frog,merida brave,tinkerbell,peter pan,captain hook,alice wonderland,mad hatter,winnie pooh,tigger,stitch lilo,woody toy story,buzz lightyear,finding nemo,dory fish,monsters inc,lightning mcqueen";

const CATS_KEYS = "tabby cat,siamese cat,persian cat,maine coon,black cat,white cat,orange cat,calico cat,sleeping cat,playing kitten,cat eyes,cat paw,whiskers,funny cat,grumpy cat,cat portrait,fluffy cat,hairless cat,bengal cat,ragdoll cat,british shorthair,scottish fold,sphynx cat,siberian cat,burmese cat,russian blue,savannah cat,norwegian forest cat,cute kitten,cat stretching";

const HISTORICAL_KEYS = "castle,palace,cathedral,temple,pyramid,colosseum,parthenon,taj mahal,great wall china,eiffel tower,big ben,statue liberty,machu picchu,petra jordan,angkor wat,acropolis,stonehenge,leaning tower pisa,hagia sophia,notre dame,versailles,neuschwanstein,himeji castle,forbidden city,kremlin,st basils,pantheon rome,mount rushmore,golden gate bridge,brooklyn bridge";

const PEOPLE_KEYS = "portrait woman,portrait man,happy child,elderly smiling,diverse group,fashion model,street portrait,candid laughing,musician playing,artist painting,dancer ballet,athlete running,doctor,chef cooking,business person,student studying,teacher,mother baby,father son,couple hugging,friends selfie,traveler,hiker,yoga pose,meditation,reading book,drinking coffee,playing guitar,holding flowers,wearing hat";

const ABSTRACT_KEYS = "abstract art,fractal,geometric pattern,colorful fluid,bokeh lights,macro texture,paint splash,ink water,smoke swirls,fire flame,glitch art,low poly,wireframe,neon lights,holographic,iridescent,metallic,wood grain,marble,crystal,diamond,glass prism,kaleidoscope,mandala,zen circles,minimalist,gradient,vaporwave,synthwave,fluid acrylic";

const NATURE_KEYS = "mountain peak,forest path,waterfall,lake reflection,sunset beach,desert dunes,snowy mountain,autumn forest,spring meadow,flower field,tropical island,canyon,river stream,thunderstorm,rainbow,starry night,northern lights,volcano,coral reef,jungle,bamboo forest,cave,glacier,cliff edge,wheat field,cherry blossom,palm tree,cactus,mossy rock,ocean wave";

const URBAN_KEYS = "city skyline,skyscraper,street lights,neon sign,busy intersection,subway station,graffiti art,bridge night,taxi cab,bus stop,rooftop view,alleyway,brick wall,concrete texture,glass building,urban park,street food,traffic trails,bicycle,scooter,pedestrian crossing,city rain,lamppost,fire escape,storefront,market stall,construction site,crane,train track,harbor";

const SPRING_KEYS = "spring flowers,tulips,daffodils,cherry blossom,green grass,baby animals,easter eggs,butterfly,rain boots,rainbow,sprout,garden,blooming tree,nest eggs,bird singing,bee flower,ladybug,picnic,kite flying,umbrella,dew drops,sunbeam,fresh fruit,vegetable garden,watering can,wheelbarrow,fence,park bench,bicycle basket,spring cleaning";

const SUMMER_KEYS = "summer beach,ice cream,sunglasses,swimming pool,palm tree,sand castle,surfboard,beach ball,flip flops,sun hat,lemonade,bbq grill,camping tent,campfire,fireworks,watermelon,pineapple,coconut,cocktail,sailboat,jetski,lifeguard tower,seagull,seashell,starfish,crab,jellyfish,sunflower,picnic blanket,road trip";

const AUTUMN_KEYS = "autumn leaves,pumpkin,halloween,thanksgiving,acorn,pinecone,mushroom,forest fog,rainy window,umbrella,boots,scarf,sweater,fireplace,hot chocolate,apple pie,corn field,scarecrow,hay bale,tractor,barn,harvest,orange tree,red maple,yellow aspen,fallen leaves,park bench,squirrel nut,owl tree,full moon";

const WINTER_KEYS = "winter snow,snowflake,snowman,ice cycle,frozen lake,skiing,snowboarding,sledding,fireplace,hot cocoa,christmas tree,gifts,reindeer,santa,ornament,wreath,lights,candle,sweater,mittens,scarf,hat,boots,cabin snow,pine tree,cardinal bird,polar bear,penguin,husky dog,aurora borealis";

const INDOOR_KEYS = "cozy living room,modern kitchen,luxury bedroom,home library,reading nook,coffee shop,restaurant,hotel lobby,hallway,staircase,window view,sofa,armchair,dining table,chandelier,bookshelf,house plant,desk setup,gaming room,loft,apartment,fireplace,bathroom spa,walk in closet,wine cellar,attic,sunroom,conservatory,garage,basement";

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
    
    // Rotate through keywords to guarantee variety
    const keyword = keywords[i % keywords.length];
    
    // Capitalize for title
    const titleKeyword = keyword.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Use comma separation for URL search to increase hit rate on LoremFlickr
    const urlKeyword = keyword.replace(/\s+/g, ',');

    return {
      // Added '-v2' to ID to invalidate previous duplicate cache
      id: `${category.toLowerCase().replace(/\s+/g, '-')}-v2-${i + 1}`,
      title: `${titleKeyword}`,
      // Use both keyword AND lock to ensure stability and uniqueness
      src: `https://loremflickr.com/800/800/${urlKeyword}?lock=${startLockId + i}`,
      difficulty,
      category
    };
  });
};

// ----------------------------------------------------------------------
// COLLECTIONS
// ----------------------------------------------------------------------

const CLASSIC_CARS = generateCategoryPuzzles('Classic Cars', CLASSIC_CARS_KEYS, 30, 1000);
const ANIMALS = generateCategoryPuzzles('Animals', ANIMALS_KEYS, 30, 2000);
const DISNEY = generateCategoryPuzzles('Disney Characters', DISNEY_KEYS, 30, 3000);
const CATS = generateCategoryPuzzles('Cats', CATS_KEYS, 30, 4000);
const HISTORICAL = generateCategoryPuzzles('Historical Buildings', HISTORICAL_KEYS, 30, 5000);
const PEOPLE = generateCategoryPuzzles('People', PEOPLE_KEYS, 30, 6000);
const ABSTRACT = generateCategoryPuzzles('Abstract', ABSTRACT_KEYS, 30, 7000);

const NATURE = generateCategoryPuzzles('Nature', NATURE_KEYS, 30, 8000);
const URBAN = generateCategoryPuzzles('Urban', URBAN_KEYS, 30, 9000);
const SPRING = generateCategoryPuzzles('Spring', SPRING_KEYS, 30, 10000);
const SUMMER = generateCategoryPuzzles('Summer', SUMMER_KEYS, 30, 11000);
const AUTUMN = generateCategoryPuzzles('Autumn', AUTUMN_KEYS, 30, 12000);
const WINTER = generateCategoryPuzzles('Winter', WINTER_KEYS, 30, 13000);
const INDOOR = generateCategoryPuzzles('Indoor', INDOOR_KEYS, 30, 14000);

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
  ...INDOOR
];

export const DIFFICULTY_SETTINGS = {
  easy: { rows: 3, cols: 3, snapThreshold: 5, rotate: false, hints: 5 },
  normal: { rows: 5, cols: 5, snapThreshold: 4, rotate: false, hints: 3 },
  hard: { rows: 7, cols: 7, snapThreshold: 3, rotate: true, hints: 1 },
  expert: { rows: 10, cols: 10, snapThreshold: 2, rotate: true, hints: 0 },
};