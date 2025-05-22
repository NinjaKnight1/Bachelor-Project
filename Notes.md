[
  {
    "hitPolicy": "UNIQUE",
    "inputs": [
      {
        "expression": "season"
      },
      {
        "expression": "guestCount"
      }
    ],
    "outputs": [
      {
        "expression": "desiredDish"
      }
    ],
    "rules": [
      {
        "post": "(= desiredDish \"Spareribs\")",
        "pre": "(and  (<= guestCount 8))",
        "row": 0
      },
      {
        "post": "(= desiredDish \"Pasta\")",
        "pre": "(and (= season \"Winter\") (> guestCount 8))",
        "row": 1
      },
      {
        "post": "(= desiredDish \"Light salad\")",
        "pre": "(and (= season \"Summer\") (> guestCount 10))",
        "row": 2
      },
      {
        "post": "(= desiredDish \"Beans salad\")",
        "pre": "(and (= season \"Summer\") (<= guestCount 10))",
        "row": 3
      },
      {
        "post": "(= desiredDish \"Stew\")",
        "pre": "(and (= season \"Spring\") (< guestCount 10))",
        "row": 4
      },
      {
        "post": "(= desiredDish \"Steak\")",
        "pre": "(and (= season \"Spring\") (>= guestCount 10))",
        "row": 5
      }
    ],
    "tableId": "dish-decision"
  }
]