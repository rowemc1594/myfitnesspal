// plan.js — all static plan data, no logic
'use strict';

const PLAN = {
  workouts: {
    'Day 1': {
      label: 'Day 1 – Legs',
      warmup: 'lower',
      exercises: [
        {
          id: 'd1a', label: 'A Lying Leg Curls',
          note: 'Toes pointed, drive hips into bench with glutes',
          sets: 4, reps: '12', tempo: '3-0-1', rest: '60-90s'
        },
        {
          id: 'd1b1', label: 'B1 Leg Press',
          note: 'Heels slightly raised, push off balls of feet',
          sets: 4, reps: '10', tempo: '2-0-1', rest: '0-15s', supersetGroup: 'B'
        },
        {
          id: 'd1b2', label: 'B2 Full Squats',
          note: 'Free bar, butt-to-heels, heels on plates, no Smith',
          sets: 4, reps: '6', tempo: '2-0-1', rest: '120s', supersetGroup: 'B'
        },
        {
          id: 'd1c', label: 'C DB Split Squats',
          note: '',
          sets: 3, reps: '12 each', tempo: '2-0-1', rest: '60s'
        },
        {
          id: 'd1d', label: 'D Romanian Deadlifts',
          note: 'Toes on plates',
          sets: 3, reps: '10', tempo: '3-0-1', rest: '60-90s'
        },
        {
          id: 'd1e', label: 'E Leg Extensions',
          note: 'Sit upright, dorsiflex the ankle all set',
          sets: 4, reps: '15', tempo: '2-0-1', rest: '30s'
        },
        {
          id: 'd1f', label: 'F Leg Press Calf Raise',
          note: '5s down, 15s pause stretched, 1s up',
          sets: 1, reps: '10-12', tempo: '5-15-1', rest: 'none'
        }
      ]
    },
    'Day 2': {
      label: 'Day 2 – Chest/Shoulders',
      warmup: 'upper',
      exercises: [
        {
          id: 'd2a', label: 'A Flat DB Press',
          note: '',
          sets: 4, reps: '8', tempo: '3-0-1', rest: '120s'
        },
        {
          id: 'd2b', label: 'B Incline Barbell Press',
          note: "Don't touch chest, no lockout, constant tension",
          sets: 3, reps: '8', tempo: '3-0-1', rest: '120s'
        },
        {
          id: 'd2c', label: 'C Slight Decline Smith Bench Press',
          note: 'Set 1=12, Set 2=10, Set 3=8, Set 4=6 (add weight each set), then drop for 8, then drop to failure',
          sets: 4, reps: '12/10/8/6+drops', tempo: '3-0-1', rest: '90s'
        },
        {
          id: 'd2d1', label: 'D1 Push Ups',
          note: '',
          sets: 3, reps: 'failure', tempo: '2-0-1', rest: '0s', supersetGroup: 'D'
        },
        {
          id: 'd2d2', label: 'D2 Pec Stretch',
          note: 'Stretch both pecs 30s between sets, 60s rest after',
          sets: 3, reps: '30s each side', tempo: '', rest: '60s', supersetGroup: 'D'
        },
        {
          id: 'd2e', label: 'E Rear Delt Machine',
          note: 'Palms down',
          sets: 4, reps: '20', tempo: '2-0-1', rest: '60s'
        },
        {
          id: 'd2f', label: 'F DB Laterals',
          note: 'Raise to 10 and 2 o\'clock',
          sets: 3, reps: '15', tempo: '2-0-1', rest: '60s'
        },
        {
          id: 'd2g', label: 'G Seated DB Press',
          note: '',
          sets: 4, reps: '6', tempo: '3-0-1', rest: '120s'
        }
      ]
    },
    'Day 3': {
      label: 'Day 3 – Back',
      warmup: 'upper',
      exercises: [
        {
          id: 'd3a', label: 'A Wide-Grip Seated Cable Row',
          note: 'Neutral grip if possible; work up in sets of 10 to a tough 10 with 2-3 reps in tank, then 3 sets',
          sets: 3, reps: '10', tempo: '2-1-1', rest: '90s'
        },
        {
          id: 'd3b1', label: 'B1 Rack Pulls from Mid Shin (Phase 1)',
          note: 'Sets of 3 until barely 3 with good form; last 3 sets are working sets',
          sets: 3, reps: '3', tempo: '2-1-1', rest: '120-180s', supersetGroup: 'B'
        },
        {
          id: 'd3b2', label: 'B2 Rack Pulls (Phase 2)',
          note: '5-min set using Phase 1 working weight; sets of 2, step back count to 10, repeat; rest 20s (30s if form slips)',
          sets: 1, reps: '5 min', tempo: '2-1-1', rest: '—', supersetGroup: 'B'
        },
        {
          id: 'd3c', label: 'C Lat Pulldowns',
          note: 'Overhand medium grip',
          sets: 4, reps: '8', tempo: '3-0-1', rest: '60-90s'
        },
        {
          id: 'd3d', label: 'D Lat Stretchers',
          note: '',
          sets: 4, reps: '12', tempo: '3-0-1', rest: '60-90s'
        },
        {
          id: 'd3e', label: 'E Hyperextensions',
          note: '',
          sets: 4, reps: '15', tempo: '3-0-1', rest: '60s'
        }
      ]
    },
    'Day 4': {
      label: 'Day 4 – Arms',
      warmup: 'upper',
      exercises: [
        {
          id: 'd4a1', label: 'A1 Seated DB Curls',
          note: 'Palms up all set',
          sets: 4, reps: '8 each', tempo: '3-0-1', rest: '0s', supersetGroup: 'A'
        },
        {
          id: 'd4a2', label: 'A2 Rope Pushdowns',
          note: '',
          sets: 4, reps: '15', tempo: '3-0-1', rest: '60s', supersetGroup: 'A'
        },
        {
          id: 'd4b1', label: 'B1 Alternating Hammer Curls',
          note: '+8 bottom partials on all sets',
          sets: 4, reps: '12 each + 8 partials', tempo: '3-0-1', rest: '0s', supersetGroup: 'B'
        },
        {
          id: 'd4b2', label: 'B2 Seated Overhead Rope Extensions',
          note: '',
          sets: 4, reps: '15', tempo: '3-0-1', rest: '60s', supersetGroup: 'B'
        },
        {
          id: 'd4c', label: 'C Machine Preacher Curls',
          note: '',
          sets: 4, reps: '15', tempo: '2-0-1', rest: '30s'
        },
        {
          id: 'd4d', label: 'D Lying Triceps Extensions',
          note: '',
          sets: 4, reps: '8', tempo: '2-0-1', rest: '60s'
        }
      ]
    },
    'Dumbbell Complex': {
      label: 'Dumbbell Complex',
      warmup: null,
      dbComplex: true,
      exercises: [
        { id: 'dc1', label: 'One-Arm DB Swing', reps: '8-10' },
        { id: 'dc2', label: 'One-Arm DB Clean & Press from Floor', reps: '8-10' },
        { id: 'dc3', label: 'One-Arm DB Squat to Press', reps: '8-10' },
        { id: 'dc4', label: 'DB Squat Thrust', reps: '8-10' }
      ],
      rounds: 6,
      restBetweenRounds: 90,
      restReductionPerWeek: 15,
      cardioAfter: '10-20 min steady-state',
      note: 'Chain without putting dumbbells down. One arm all reps then the other.'
    }
  },

  workoutOrder: ['Day 1', 'Day 2', 'Dumbbell Complex', 'Day 3', 'Day 4'],

  // Default workout per weekday, Monday first
  schedule: ['Day 1', 'Day 2', 'Dumbbell Complex', 'Day 3', 'Day 4', 'Rest', 'Rest'],
  // One-line description shown under the workout name in pickers
  focus: {
    'Day 1': 'Legs · hamstrings, quads, calves',
    'Day 2': 'Chest & shoulders',
    'Dumbbell Complex': 'Full-body dumbbell circuit + cardio',
    'Day 3': 'Back · rows, rack pulls, lats',
    'Day 4': 'Arms · biceps & triceps',
    'Rest': 'No training today'
  },
  shortNames: { 'Day 1': 'Day 1', 'Day 2': 'Day 2', 'Dumbbell Complex': 'DB Cx', 'Day 3': 'Day 3', 'Day 4': 'Day 4', 'Rest': 'Rest' },

  warmups: {
    lower: [
      'Cat/Camel',
      'Warrior Lunge Stretch — 2×20-25s per side',
      'Bird Dogs',
      'Two-Legged Glute Bridges',
      'Front-to-Back Hip Swings',
      'Frontal Plane Hip Swings',
      'Dynamic Calf Stretch'
    ],
    upper: [
      'Scapular Push Ups',
      'Broomstick Dislocations',
      'Shoulder Circles (little to big)',
      'Wall Slides',
      'Reach-Roll-Lift',
      'Dynamic Blackburns'
    ],
    liftingNote: 'A couple of light, progressively heavier low-rep sets before work sets (e.g. 45×5, 65×3, 85×1, then 100 for work sets).'
  },

  // Illustration file per warm-up in images/warmups/ (see PROMPTS.md there); missing files are simply not shown
  warmupImages: {
    'Cat/Camel': 'cat-camel.png',
    'Warrior Lunge Stretch — 2×20-25s per side': 'warrior-lunge-stretch.png',
    'Bird Dogs': 'bird-dogs.png',
    'Two-Legged Glute Bridges': 'glute-bridges.png',
    'Front-to-Back Hip Swings': 'hip-swings-front-back.png',
    'Frontal Plane Hip Swings': 'hip-swings-side.png',
    'Dynamic Calf Stretch': 'dynamic-calf-stretch.png',
    'Scapular Push Ups': 'scapular-push-ups.png',
    'Broomstick Dislocations': 'broomstick-dislocations.png',
    'Shoulder Circles (little to big)': 'shoulder-circles.png',
    'Wall Slides': 'wall-slides.png',
    'Reach-Roll-Lift': 'reach-roll-lift.png',
    'Dynamic Blackburns': 'dynamic-blackburns.png'
  },

  // Tap-to-learn guides, keyed by the exact names in warmups above
  warmupInfo: {
    'Cat/Camel': {
      why: 'Loosens the whole spine before you load it.',
      dose: '8–10 slow reps',
      steps: ['Start on hands and knees, hands under shoulders, knees under hips.',
        'Cat: round your back up toward the ceiling and tuck your chin.',
        'Camel: let your belly drop, lift your chest and tailbone, look slightly up.',
        'Move slowly between the two, one breath each way.'],
      cue: 'Move through the whole spine; don\'t just bend at the neck.'
    },
    'Warrior Lunge Stretch — 2×20-25s per side': {
      why: 'Opens the hip flexors so you can squat deep and keep your hips under you.',
      dose: '2 × 20–25 seconds per side',
      steps: ['Kneel in a lunge: one knee down, other foot flat in front.',
        'Squeeze the glute of the back leg and tuck your pelvis under.',
        'Shift forward slightly until you feel a stretch at the front of the back hip.',
        'Reach the arm on the back-leg side straight overhead and lean a little away.'],
      cue: 'Glute squeeze first. Don\'t arch your lower back to fake the stretch.'
    },
    'Bird Dogs': {
      why: 'Wakes up your core and glutes and teaches a stable, flat back.',
      dose: '8 per side',
      steps: ['Start on hands and knees with a flat back.',
        'Reach one arm forward and the opposite leg back until both are level with your body.',
        'Hold 1–2 seconds without letting your hips tip or rotate.',
        'Return under control and switch sides.'],
      cue: 'Imagine a glass of water on your lower back. Don\'t spill it.'
    },
    'Two-Legged Glute Bridges': {
      why: 'Switches on the glutes before squats and deadlifts.',
      dose: '10–12 reps, 2-second squeeze at the top',
      steps: ['Lie on your back, knees bent, feet flat and hip-width apart.',
        'Push through your heels and squeeze your glutes to lift your hips.',
        'Stop when shoulders, hips and knees are in a straight line.',
        'Hold, then lower slowly.'],
      cue: 'Push the hips up with the glutes, not by arching the lower back.'
    },
    'Front-to-Back Hip Swings': {
      why: 'Dynamically loosens hamstrings and hip flexors.',
      dose: '10–15 swings per leg',
      steps: ['Stand side-on to a wall or rack and hold it for balance.',
        'Swing the outside leg forward and back like a pendulum.',
        'Start small and let the swings get bigger each rep.',
        'Switch sides.'],
      cue: 'Stay tall. The leg moves, your torso doesn\'t.'
    },
    'Frontal Plane Hip Swings': {
      why: 'Loosens the inner thigh (adductors) and outer hip for squat depth.',
      dose: '10–15 swings per leg',
      steps: ['Face a wall or rack with both hands on it.',
        'Swing one leg across your body, then out to the side.',
        'Gradually increase the range.',
        'Switch legs.'],
      cue: 'Keep your hips facing the wall; don\'t twist with the swing.'
    },
    'Dynamic Calf Stretch': {
      why: 'Improves ankle mobility so your knees can travel forward in squats.',
      dose: '10 per side',
      steps: ['Hands on a wall, one foot stepped back with the leg straight.',
        'Press the back heel down to feel the calf stretch.',
        'Lift the heel, then press it back down, rocking gently.',
        'Switch legs.'],
      cue: 'Keep the back foot pointing straight ahead.'
    },
    'Scapular Push Ups': {
      why: 'Activates the muscles that control your shoulder blades before pressing.',
      dose: '10–12 reps',
      steps: ['Get in a push-up position with arms straight (or on your knees).',
        'Keeping elbows locked, let your shoulder blades pinch together so your chest sinks a little.',
        'Push the floor away to spread your shoulder blades apart.',
        'That\'s one rep. Your arms never bend.'],
      cue: 'Small movement, all from the shoulder blades.'
    },
    'Broomstick Dislocations': {
      why: 'Opens up the shoulders and chest through a full overhead range. (Nothing actually dislocates.)',
      dose: '10–15 slow reps',
      steps: ['Hold a broomstick or PVC pipe with a very wide overhand grip, arms straight, in front of your hips.',
        'Keeping arms straight, raise the stick up over your head.',
        'Keep going until it comes down behind your back to your hips.',
        'Reverse the path back to the front.'],
      cue: 'If you have to bend your elbows, widen your grip. Narrow it over the weeks as you loosen up. Never force it through pain.'
    },
    'Shoulder Circles (little to big)': {
      why: 'Gets blood into the shoulder joint through every angle.',
      dose: '10 forward, then 10 backward',
      steps: ['Stand tall with arms straight out to the sides.',
        'Make small circles with your hands.',
        'Gradually make each circle bigger until they\'re full arm circles.',
        'Reverse direction.'],
      cue: 'Smooth and controlled. No flinging.'
    },
    'Wall Slides': {
      why: 'Trains your shoulders to go overhead with good posture.',
      dose: '10 slow reps',
      steps: ['Stand with your back, head and backside against a wall, feet a little out.',
        'Put your arms against the wall in a "goalpost" shape: elbows bent 90°, at shoulder height.',
        'Slide your arms up the wall toward a "Y" while keeping elbows and wrists touching it.',
        'Slide back down, squeezing your shoulder blades down and together.'],
      cue: 'Keep your lower back on the wall. Only go as high as you can without it arching.'
    },
    'Reach-Roll-Lift': {
      why: 'Builds upper-back mobility and wakes up the lower traps.',
      dose: '8 per side',
      steps: ['Kneel and sit back on your heels, forearms and forehead toward the floor (like child\'s pose).',
        'Reach one arm forward along the floor, palm down.',
        'Roll the palm so your thumb points up.',
        'Lift the straight arm off the floor, hold 2 seconds, lower. Repeat, then switch arms.'],
      cue: 'Keep your backside on your heels so your lower back can\'t cheat.'
    },
    'Dynamic Blackburns': {
      why: 'Strengthens the upper back and rear shoulders that keep your shoulders healthy when pressing.',
      dose: '8–10 slow reps',
      steps: ['Lie face down, forehead on a towel, arms out overhead in a "Y", thumbs up.',
        'Lift your arms off the floor by squeezing your shoulder blades.',
        'Keeping them lifted, sweep your arms down to your sides like a snow angel.',
        'Sweep back up and repeat without resting your arms.'],
      cue: 'Thumbs stay pointed up the whole time.'
    }
  },

  tempoHelp: {
    title: 'Tempo Explained',
    body: [
      'Tempo is written as 3 digits: Eccentric – Bottom pause – Concentric.',
      'Example 3-0-1: 3 seconds lowering, no pause at bottom, 1 second lifting.',
      'Example 5-15-1 (calf raise): 5s down, 15s pause in stretched position, 1s up.',
      'Focus on the eccentric (lowering) phase — this builds the most muscle.'
    ]
  },

  // Suggested time for each meal slot, in the order you eat them (1st, 2nd, …)
  mealTimes: ['7:00 AM', '10:00 AM', '12:00 PM', '2:30 PM', '6:00 PM'],

  meals: {
    training: [
      {
        id: 'tm1', label: 'Meal 1',
        items: [
          '1 whole egg + 5 egg whites',
          '40g oats (dry)',
          '1 serving fruit'
        ]
      },
      {
        id: 'tm2', label: 'Meal 2',
        items: [
          '220g cottage cheese',
          'Rice cake up to 120 cal',
          '14g almonds'
        ]
      },
      {
        id: 'tm3', label: 'Meal 3',
        items: [
          '120g chicken breast OR 174g tuna (cooked weight)',
          'Tortillas up to 120 cal',
          '22g full-fat cheese',
          'Optional: 1 cup veg'
        ]
      },
      {
        id: 'tm4', label: 'Meal 4 (Post-Workout)',
        postWorkout: true,
        items: [
          '45g protein powder',
          'Any low-fat carb up to 250 cal (46–52g carbs)'
        ]
      },
      {
        id: 'tm5', label: 'Meal 5',
        items: [
          '110g top sirloin OR 116g 95% lean ground beef (cooked weight)',
          '150g russet potato (dry weight)',
          '17g cashews',
          'Optional veg',
          '1 tsp liquid fish oil'
        ]
      }
    ],
    nonTraining: [
      {
        id: 'ntm1', label: 'Meal 1',
        items: [
          '2 whole eggs + 3 whites',
          '15g full-fat cheese',
          '5g coconut oil or 6g butter',
          'Optional veg'
        ]
      },
      {
        id: 'ntm2', label: 'Meal 2',
        items: [
          '45g protein powder',
          'Rice cake up to 120 cal',
          '14g almonds'
        ]
      },
      {
        id: 'ntm3', label: 'Meal 3',
        items: [
          '115g chicken breast OR 194g shrimp (cooked weight)',
          '115g quinoa (cooked)',
          '1 serving fruit',
          'Optional veg'
        ]
      },
      {
        id: 'ntm4', label: 'Meal 4',
        items: [
          '110g top sirloin OR 122g pork tenderloin (cooked weight)',
          '30g full-fat cheese',
          '50g avocado',
          'Optional veg'
        ]
      },
      {
        id: 'ntm5', label: 'Meal 5',
        items: [
          '200g cottage cheese',
          '20g protein powder',
          '25g natural peanut butter',
          '1 tsp liquid fish oil'
        ]
      }
    ]
  },

  dietNotes: [
    'Use a scale for all weights.',
    'Never lift or do intervals fasted — take BCAAs if training early.',
    'Salad greens are free (unlimited).',
    'No oil-based marinades.',
    'Unsweetened almond milk ≈ 35–40 cal/cup.',
    'Plain Greek yogurt only.',
    'Target ~16 cups (128 oz) water per day.',
    'First 14 days: 100% compliance, no cheats.'
  ],

  // Amounts mirror the meal plan above; keep in sync if meals change
  dailySupplements: [
    { id: 'fishoil', label: 'Fish oil',
      amount: { training: '1 tsp liquid · with Meal 5', nonTraining: '1 tsp liquid · with Meal 5' } },
    { id: 'protein', label: 'Protein powder',
      amount: { training: '45 g · Meal 4 (post-workout)', nonTraining: '65 g · 45 g Meal 2 + 20 g Meal 5' } },
    { id: 'pickles', label: 'Dill pickles',
      amount: { training: '2 pickles', nonTraining: '2 pickles' } }
  ]
};

if (typeof module !== 'undefined') module.exports = PLAN;
