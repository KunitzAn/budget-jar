import {
  Apple,
  Baby,
  Banknote,
  Beer,
  Bike,
  BookOpen,
  Bus,
  Camera,
  Car,
  Coffee,
  CreditCard,
  Dog,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gift,
  Hotel,
  House,
  IceCream,
  Landmark,
  Phone,
  Pill,
  Plane,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Soup,
  Sparkles,
  Stethoscope,
  Ticket,
  Train,
  TreePalm,
  Utensils,
  Waves,
  Wifi,
} from '@lucide/vue'
import type { Component } from 'vue'

/**
 * Набор иконок для статей трат. Список закрытый: в базе лежит только имя,
 * и оно должно гарантированно находиться здесь — иначе строка, приехавшая с
 * другого устройства с более новой версией, осталась бы без картинки.
 */
export const ICONS: Record<string, Component> = {
  Utensils,
  Soup,
  Coffee,
  Beer,
  IceCream,
  Apple,
  ShoppingCart,
  ShoppingBag,
  Hotel,
  House,
  Bus,
  Train,
  Car,
  Bike,
  Plane,
  Fuel,
  Ticket,
  Camera,
  Waves,
  TreePalm,
  Sparkles,
  Dumbbell,
  Scissors,
  Pill,
  Stethoscope,
  Shirt,
  Gift,
  BookOpen,
  Phone,
  Wifi,
  Baby,
  Dog,
  Landmark,
  Banknote,
  CreditCard,
  Ellipsis,
}

export const ICON_NAMES = Object.keys(ICONS)

export const FALLBACK_ICON = 'Ellipsis'

export function iconComponent(name: string): Component {
  return ICONS[name] ?? ICONS[FALLBACK_ICON]!
}
