import { Injectable } from '@nestjs/common';

@Injectable()
export class HelperService {
  mb2bytes(mb: number): number {
    return mb * 1024 * 1024;
  }

  fillMissingMonths(data: any[], from, to): any[] {
    const transformedData: any[] = [];

    // Create a set to store existing months
    const monthSet: Set<string> = new Set();

    // Iterate over the original data and populate the monthSet
    data.forEach((entry) => {
      monthSet.add(entry.date);
    });

    // Find the minimum and maximum months from the original data
    const minMonth = from;
    const maxMonth = to;

    // Parse the year and month from the minimum and maximum months
    const [minYear, minMonthNumber] = minMonth.split('-');
    const [maxYear, maxMonthNumber] = maxMonth.split('-');

    // Convert the minimum and maximum months to numbers
    const minMonthIndex = parseInt(minMonthNumber);
    const maxMonthIndex = parseInt(maxMonthNumber);

    // Iterate over the range of years between the minimum and maximum years
    for (let year = parseInt(minYear); year <= parseInt(maxYear); year++) {
      // Determine the start and end months for each year
      const startMonth = year === parseInt(minYear) ? minMonthIndex : 1;
      const endMonth = year === parseInt(maxYear) ? maxMonthIndex : 12;

      // Iterate over the range of months for each year
      for (let monthIndex = startMonth; monthIndex <= endMonth; monthIndex++) {
        const month = monthIndex.toString().padStart(2, '0');
        const monthYear = `${year}-${month}`;

        // If the month is not in the monthSet, add entries with amount 0
        if (!monthSet.has(monthYear)) {
          transformedData.push({
            date: monthYear,
            type: 'Amount In',
            amount: 0,
          });
          transformedData.push({
            date: monthYear,
            type: 'Amount Out',
            amount: 0,
          });
        }
      }
    }

    // Concatenate the existing data with the filled-in data
    const filledData = [...data, ...transformedData];

    // Sort the array by date
    filledData.sort((a, b) => (a.date > b.date ? 1 : -1));

    return filledData;
  }

  fillMissingDays(data: any[], from, to): any[] {
    const transformedData: any[] = [];

    // Create a map to store existing dates
    const dateMap: { [key: string]: boolean } = {};

    // Iterate over the original data and populate the dateMap
    data.forEach((entry) => {
      dateMap[entry.date] = true;
    });

    // // Find the minimum and maximum dates from the original data
    // const minDate = data.reduce(
    //   (min, entry) => (entry.date < min ? entry.date : min),
    //   data[0].date,
    // );
    // const maxDate = data.reduce(
    //   (max, entry) => (entry.date > max ? entry.date : max),
    //   data[0].date,
    // );

    // Iterate over the range of dates between the minimum and maximum dates
    const currentDate = new Date(from);
    const endDate = new Date(to);
    while (currentDate <= endDate) {
      const formattedDate = currentDate.toISOString().slice(0, 10);

      // If the current date is not in the dateMap, add entries with amount 0
      if (!dateMap[formattedDate]) {
        transformedData.push({
          date: formattedDate,
          type: 'Amount In',
          amount: 0,
        });
        transformedData.push({
          date: formattedDate,
          type: 'Amount Out',
          amount: 0,
        });
      }

      // Move to the next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Concatenate the existing data with the filled-in data
    const filledData = [...data, ...transformedData];

    // Sort the array by date
    filledData.sort((a, b) => (a.date > b.date ? 1 : -1));

    return filledData;
  }
}
