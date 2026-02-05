import { useState, useEffect } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Common countries with their dial codes
const COUNTRIES = [
  { code: "US", name: "United States", dialCode: "+1" },
  { code: "CA", name: "Canada", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", dialCode: "+44" },
  { code: "JO", name: "Jordan", dialCode: "+962" },
  { code: "AE", name: "UAE", dialCode: "+971" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { code: "EG", name: "Egypt", dialCode: "+20" },
  { code: "LB", name: "Lebanon", dialCode: "+961" },
  { code: "SY", name: "Syria", dialCode: "+963" },
  { code: "IQ", name: "Iraq", dialCode: "+964" },
  { code: "PS", name: "Palestine", dialCode: "+970" },
  { code: "KW", name: "Kuwait", dialCode: "+965" },
  { code: "QA", name: "Qatar", dialCode: "+974" },
  { code: "BH", name: "Bahrain", dialCode: "+973" },
  { code: "OM", name: "Oman", dialCode: "+968" },
  { code: "YE", name: "Yemen", dialCode: "+967" },
  { code: "DE", name: "Germany", dialCode: "+49" },
  { code: "FR", name: "France", dialCode: "+33" },
  { code: "IT", name: "Italy", dialCode: "+39" },
  { code: "ES", name: "Spain", dialCode: "+34" },
  { code: "NL", name: "Netherlands", dialCode: "+31" },
  { code: "BE", name: "Belgium", dialCode: "+32" },
  { code: "CH", name: "Switzerland", dialCode: "+41" },
  { code: "AT", name: "Austria", dialCode: "+43" },
  { code: "SE", name: "Sweden", dialCode: "+46" },
  { code: "NO", name: "Norway", dialCode: "+47" },
  { code: "DK", name: "Denmark", dialCode: "+45" },
  { code: "FI", name: "Finland", dialCode: "+358" },
  { code: "PL", name: "Poland", dialCode: "+48" },
  { code: "PT", name: "Portugal", dialCode: "+351" },
  { code: "GR", name: "Greece", dialCode: "+30" },
  { code: "TR", name: "Turkey", dialCode: "+90" },
  { code: "RU", name: "Russia", dialCode: "+7" },
  { code: "IN", name: "India", dialCode: "+91" },
  { code: "PK", name: "Pakistan", dialCode: "+92" },
  { code: "BD", name: "Bangladesh", dialCode: "+880" },
  { code: "CN", name: "China", dialCode: "+86" },
  { code: "JP", name: "Japan", dialCode: "+81" },
  { code: "KR", name: "South Korea", dialCode: "+82" },
  { code: "AU", name: "Australia", dialCode: "+61" },
  { code: "NZ", name: "New Zealand", dialCode: "+64" },
  { code: "BR", name: "Brazil", dialCode: "+55" },
  { code: "MX", name: "Mexico", dialCode: "+52" },
  { code: "AR", name: "Argentina", dialCode: "+54" },
  { code: "ZA", name: "South Africa", dialCode: "+27" },
  { code: "NG", name: "Nigeria", dialCode: "+234" },
  { code: "KE", name: "Kenya", dialCode: "+254" },
  { code: "MA", name: "Morocco", dialCode: "+212" },
  { code: "TN", name: "Tunisia", dialCode: "+216" },
  { code: "DZ", name: "Algeria", dialCode: "+213" },
  { code: "LY", name: "Libya", dialCode: "+218" },
  { code: "SD", name: "Sudan", dialCode: "+249" },
  { code: "MY", name: "Malaysia", dialCode: "+60" },
  { code: "SG", name: "Singapore", dialCode: "+65" },
  { code: "ID", name: "Indonesia", dialCode: "+62" },
  { code: "TH", name: "Thailand", dialCode: "+66" },
  { code: "VN", name: "Vietnam", dialCode: "+84" },
  { code: "PH", name: "Philippines", dialCode: "+63" },
].sort((a, b) => a.name.localeCompare(b.name))

type PhoneInputProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * Phone input with country code selector
 * Stores value in E.164 format (e.g., +962791234567)
 */
export function PhoneInput({
  value,
  onChange,
  disabled,
  className,
  id,
}: PhoneInputProps) {
  // Parse the E.164 value to extract country and local number
  const parseValue = (e164: string): { countryCode: string; localNumber: string } => {
    if (!e164) {
      return { countryCode: "JO", localNumber: "" }
    }

    // Try to match the dial code
    for (const country of COUNTRIES) {
      if (e164.startsWith(country.dialCode)) {
        return {
          countryCode: country.code,
          localNumber: e164.slice(country.dialCode.length),
        }
      }
    }

    // Default to Jordan if no match
    return { countryCode: "JO", localNumber: e164.replace(/^\+/, "") }
  }

  const { countryCode: initialCountry, localNumber: initialNumber } = parseValue(value)
  const [countryCode, setCountryCode] = useState(initialCountry)
  const [localNumber, setLocalNumber] = useState(initialNumber)

  // Update internal state when external value changes
  useEffect(() => {
    const { countryCode: newCountry, localNumber: newNumber } = parseValue(value)
    setCountryCode(newCountry)
    setLocalNumber(newNumber)
  }, [value])

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode)

  const handleCountryChange = (newCountryCode: string) => {
    setCountryCode(newCountryCode)
    const country = COUNTRIES.find((c) => c.code === newCountryCode)
    if (country && localNumber) {
      onChange(`${country.dialCode}${localNumber}`)
    }
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const digits = e.target.value.replace(/\D/g, "")
    setLocalNumber(digits)
    if (selectedCountry) {
      onChange(digits ? `${selectedCountry.dialCode}${digits}` : "")
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={countryCode}
        onValueChange={handleCountryChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[140px] bg-background/50">
          <SelectValue>
            {selectedCountry && (
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">{selectedCountry.dialCode}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {COUNTRIES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <span className="flex items-center gap-2">
                <span>{country.name}</span>
                <span className="text-muted-foreground">{country.dialCode}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        placeholder="Phone number"
        value={localNumber}
        onChange={handleNumberChange}
        disabled={disabled}
        className="flex-1 bg-background/50"
      />
    </div>
  )
}
